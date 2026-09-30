#!/usr/bin/env node

"use strict";

import { readFileSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SEED_DIR = join(ROOT, "demo", "seed");
const SEED_FILE = join(SEED_DIR, "bloom.json");
const output = resolve(process.argv[2] || join(ROOT, "bloom-demo-seed.tgz"));

if (process.argv.length > 3) {
  throw new Error("Usage: node scripts/make-bloom-demo-seed.mjs [output.tgz]");
}

validateSeed(JSON.parse(readFileSync(SEED_FILE, "utf8")));
rmSync(output, { force: true });
await makeArchive(output);
console.log(`Wrote reviewed Bloom demo seed: ${output}`);

function validateSeed(seed) {
  if (!seed || typeof seed !== "object" || Array.isArray(seed)) {
    throw new Error("Demo seed must be an object");
  }

  const keys = Object.keys(seed).sort();
  const expected = ["invites", "saves", "sessions", "users"];
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    throw new Error("Demo seed may contain only invites, users, sessions, and saves");
  }
  if (!Array.isArray(seed.invites) || seed.invites.length !== 0) {
    throw new Error("Demo seed invites must be empty");
  }
  for (const key of ["users", "sessions", "saves"]) {
    const value = seed[key];
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 0) {
      throw new Error(`Demo seed ${key} must be an empty object`);
    }
  }
}

function makeArchive(destination) {
  return new Promise((resolveArchive, rejectArchive) => {
    const child = spawn("tar", ["-czf", destination, "-C", SEED_DIR, "."], {
      stdio: ["ignore", "ignore", "pipe"]
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("error", rejectArchive);
    child.on("close", (code) => {
      if (code === 0) resolveArchive();
      else rejectArchive(new Error(`tar exited with code ${code}: ${stderr.trim()}`));
    });
  });
}
