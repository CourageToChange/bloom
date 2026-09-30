"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("DEMO_MODE blocks every mutating route while reads keep working", async (t) => {
  const started = await startIsolatedServer("true");
  t.after(() => started.stop());

  const health = await fetch(`${started.url}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const config = await fetch(`${started.url}/auth/config`);
  assert.equal(config.status, 200);
  assert.equal((await config.json()).enforced, false);

  const shell = await fetch(`${started.url}/`);
  assert.equal(shell.status, 200);
  assert.match(await shell.text(), /<title>Bloom/);

  const mutatingRequests = [
    ["POST", "/auth/logout", {}],
    ["POST", "/auth/google", { credential: "placeholder" }],
    ["POST", "/admin/invites", { email: "placeholder" }],
    ["DELETE", "/admin/invites", { email: "placeholder" }],
    ["PUT", "/user/state", { progress: { "2026-01-01": 1 } }],
    ["PATCH", "/user/state", { progress: { "2026-01-01": 1 } }]
  ];

  for (const [method, route, body] of mutatingRequests) {
    const response = await fetch(`${started.url}${route}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 403, `${method} ${route} was not blocked`);
    assert.deepEqual(await response.json(), { ok: false, error: "The public demo is read-only." });
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("DEMO_MODE prevents read-triggered maintenance from persisting", async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bloom-demo-read-"));
  const file = path.join(dataDir, "bloom.json");
  const original = JSON.stringify({
    invites: [],
    users: {},
    sessions: { expired: { sub: "placeholder", expires: 0 } },
    saves: {}
  });
  fs.writeFileSync(file, original);
  const started = await startIsolatedServer("true", dataDir);
  t.after(() => started.stop());

  const response = await fetch(`${started.url}/auth/me`);
  assert.equal(response.status, 200);
  assert.equal(fs.readFileSync(file, "utf8"), original);
});

test("unset DEMO_MODE retains the existing mutating-route behaviour", async (t) => {
  const started = await startIsolatedServer();
  t.after(() => started.stop());

  const response = await fetch(`${started.url}/auth/logout`, { method: "POST" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("an invalid DEMO_MODE value fails closed", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bloom-demo-invalid-"));
  try {
    await assert.rejects(
      runChild(`require(${JSON.stringify(path.join(root, "server.js"))})`, {
        DEMO_MODE: "misspelled",
        DATA_DIR: dataDir
      }),
      /DEMO_MODE must be true or false/
    );
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

function startIsolatedServer(demoMode, suppliedDataDir) {
  const dataDir = suppliedDataDir || fs.mkdtempSync(path.join(os.tmpdir(), "bloom-demo-http-"));
  const script = `
    const { app } = require(${JSON.stringify(path.join(root, "server.js"))});
    const server = app.listen(0, () => {
      process.stdout.write("PORT:" + server.address().port + "\\n");
    });
  `;
  // Outside DEMO_MODE the server REFUSES TO BOOT without Cloudflare Access config.
  // That fail-closed behaviour is deliberate and is exactly what we want in
  // production, so the harness supplies throwaway config rather than the server
  // being made lenient. These values only have to satisfy the shape checks in
  // access-jwt.js; no token is ever verified in these tests.
  const env = {
    ...process.env,
    DATA_DIR: dataDir,
    GOOGLE_CLIENT_ID: "",
    BLOOM_ADMIN_EMAILS: "",
    ACCESS_TEAM_DOMAIN: "https://example.cloudflareaccess.com",
    ACCESS_AUD: "test-audience"
  };
  if (demoMode === undefined) delete env.DEMO_MODE;
  else env.DEMO_MODE = demoMode;
  const child = spawn(process.execPath, ["-e", script], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => fail(new Error(`server start timed out: ${stderr}`)), 5000);
    const fail = (error) => {
      clearTimeout(timeout);
      child.kill();
      fs.rmSync(dataDir, { recursive: true, force: true });
      reject(error);
    };
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", fail);
    child.on("exit", (code) => {
      if (!stdout.includes("PORT:")) fail(new Error(`server exited with code ${code}: ${stderr}`));
    });
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      const match = stdout.match(/PORT:(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve({
        url: `http://localhost:${match[1]}`,
        stop() {
          child.kill();
          fs.rmSync(dataDir, { recursive: true, force: true });
        }
      });
    });
  });
}

function runChild(script, extraEnv) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["-e", script], {
      cwd: root,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`child exited with code ${code}: ${stderr}`));
    });
  });
}
