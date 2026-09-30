#!/usr/bin/env bash
# Restore the public Bloom demo to its reviewed, empty account-state seed.
# This is a reviewer-run host script. It is not invoked by the application.

set -euo pipefail

# Bloom uses a docker named volume for its private data, and the demo host has no
# /mnt/bloom-data mount. The demo therefore uses a dedicated host directory, kept
# isolated from private Bloom data.
DATA_MOUNT="/mnt/bloom-demo-data"
DEMO_DIR="${DATA_MOUNT}/demo"
SEED_TARBALL="/opt/bloom-demo-seed.tgz"
CONTAINER_NAME="bloom-demo"
DEMO_OWNER_UID=1000
DEMO_OWNER_GID=1000

if [[ "$EUID" -ne 0 ]]; then
  echo "ERROR: run this reset as root" >&2
  exit 1
fi

for command in docker realpath tar mktemp chown chmod; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "ERROR: required command is unavailable: $command" >&2
    exit 1
  fi
done

if [[ ! -d "$DATA_MOUNT" || -L "$DATA_MOUNT" ]]; then
  echo "ERROR: Bloom demo data dir is missing or is a symlink: $DATA_MOUNT" >&2
  exit 1
fi

if [[ ! -d "$DEMO_DIR" || -L "$DEMO_DIR" ]]; then
  echo "ERROR: demo directory is missing or is a symlink: $DEMO_DIR" >&2
  exit 1
fi
if [[ "$(realpath -e "$DEMO_DIR")" != "$DEMO_DIR" ]]; then
  echo "ERROR: demo directory does not resolve to its allowlisted path" >&2
  exit 1
fi

if [[ ! -f "$SEED_TARBALL" || -L "$SEED_TARBALL" ]]; then
  echo "ERROR: reviewed seed tarball is missing or is a symlink: $SEED_TARBALL" >&2
  exit 1
fi
if [[ "$(realpath -e "$SEED_TARBALL")" != "$SEED_TARBALL" ]]; then
  echo "ERROR: seed tarball does not resolve to its allowlisted path" >&2
  exit 1
fi

if ! docker container inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "ERROR: demo container does not exist: $CONTAINER_NAME" >&2
  exit 1
fi

backup_dir="${DATA_MOUNT}/.bloom-demo-previous"
if [[ -e "$backup_dir" ]]; then
  echo "ERROR: stale reset backup requires manual review: $backup_dir" >&2
  exit 1
fi

# Exact name, count, and archive-entry-type allowlists prevent traversal,
# duplicate-file overrides, links, devices, and unexpected seed material.
mapfile -t archive_entries < <(tar -tzf "$SEED_TARBALL")
if [[ "${#archive_entries[@]}" -ne 2 ]]; then
  echo "ERROR: seed archive must contain exactly two entries" >&2
  exit 1
fi
root_entries=0
seed_entries=0
for entry in "${archive_entries[@]}"; do
  case "$entry" in
    ./) root_entries=$((root_entries + 1)) ;;
    ./bloom.json) seed_entries=$((seed_entries + 1)) ;;
    *)
      echo "ERROR: unexpected path in seed archive: $entry" >&2
      exit 1
      ;;
  esac
done
if [[ "$root_entries" -ne 1 || "$seed_entries" -ne 1 ]]; then
  echo "ERROR: seed archive paths are missing or duplicated" >&2
  exit 1
fi

mapfile -t verbose_entries < <(tar -tvzf "$SEED_TARBALL")
if [[ "${#verbose_entries[@]}" -ne 2 ]] \
  || [[ "${verbose_entries[0]}" != d*" ./" ]] \
  || [[ "${verbose_entries[1]}" != -*" ./bloom.json" ]]; then
  echo "ERROR: seed archive contains an unexpected entry type or order" >&2
  exit 1
fi

staging_dir="$(mktemp -d "${DATA_MOUNT}/.bloom-demo-reset.XXXXXX")"
cleanup_staging=true
restore_needed=false
container_stopped=false

cleanup() {
  if [[ "$restore_needed" == true && -d "$backup_dir" ]]; then
    echo "Reset failed; restoring the previous demo data" >&2
    docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
    rm -rf -- "$DEMO_DIR"
    mv -- "$backup_dir" "$DEMO_DIR"
    docker start "$CONTAINER_NAME" >/dev/null 2>&1 || true
  elif [[ "$container_stopped" == true ]]; then
    docker start "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi
  if [[ "$cleanup_staging" == true && -d "$staging_dir" ]]; then
    rm -rf -- "$staging_dir"
  fi
}
trap cleanup EXIT

tar --extract --gzip --file "$SEED_TARBALL" --directory "$staging_dir" \
  --no-same-owner --no-same-permissions
if [[ ! -f "${staging_dir}/bloom.json" || -L "${staging_dir}/bloom.json" ]]; then
  echo "ERROR: extracted Bloom seed is not a regular file" >&2
  exit 1
fi
chown -R "${DEMO_OWNER_UID}:${DEMO_OWNER_GID}" "$staging_dir"
chmod 0750 "$staging_dir"
chmod 0640 "${staging_dir}/bloom.json"

echo "Stopping container: $CONTAINER_NAME"
docker stop "$CONTAINER_NAME" >/dev/null
container_stopped=true

echo "Replacing demo data from the reviewed seed"
mv -- "$DEMO_DIR" "$backup_dir"
restore_needed=true
mv -- "$staging_dir" "$DEMO_DIR"
cleanup_staging=false

echo "Starting container: $CONTAINER_NAME"
docker start "$CONTAINER_NAME" >/dev/null
container_stopped=false

echo "Waiting for the in-container health check"
for _ in {1..30}; do
  if docker exec "$CONTAINER_NAME" node -e '
    const http = require("node:http");
    const req = http.get({ port: 4000, path: "/health", timeout: 1000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          process.exit(res.statusCode === 200 && data.ok === true ? 0 : 1);
        } catch {
          process.exit(1);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => process.exit(1));
  ' >/dev/null 2>&1; then
    echo "Health check passed inside $CONTAINER_NAME"
    restore_needed=false
    rm -rf -- "$backup_dir"
    trap - EXIT
    exit 0
  fi
  sleep 1
done

echo "ERROR: in-container health check failed after 30 seconds" >&2
exit 1
