"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "sw.js"), "utf8");

test("account and generated routes use only the network while shell assets stay cache-first", async () => {
  const handlers = {};
  const seen = { fetch: [], cache: [], put: [] };
  const hit = { cached: true };
  const context = {
    URL,
    self: { location: { origin: "https://bloom.example" }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: {
      match: async (request) => { seen.cache.push(request.url); return hit; },
      open: async () => ({ put: async (request) => { seen.put.push(request.url); } })
    },
    fetch: async (request, options) => {
      seen.fetch.push({ url: request.url, cache: options && options.cache });
      return { network: true, clone() { return this; } };
    }
  };
  vm.runInNewContext(source, context);
  async function get(pathname) {
    let response;
    handlers.fetch({ request: { method: "GET", mode: "cors", url: `https://bloom.example${pathname}` },
      respondWith(promise) { response = promise; } });
    return response;
  }
  for (const route of ["/auth/me", "/user/state", "/api/example", "/admin/invites", "/runtime-config.js", "/health", "/future-dynamic-route"]) {
    assert.equal((await get(route)).network, true);
  }
  assert.equal(seen.cache.length, 0);
  assert.equal(seen.put.length, 0);
  assert.ok(seen.fetch.every((call) => call.cache === "no-store"));
  assert.deepEqual(await get("/app.js"), hit);
  assert.equal(seen.cache.length, 1);
  assert.equal(seen.fetch.length, 7);
});

test("activation deletes every cache except the new version", async () => {
  const handlers = {};
  const deleted = [];
  const context = {
    URL,
    self: { location: { origin: "https://bloom.example" },
      clients: { claim: async () => {} }, addEventListener: (name, fn) => { handlers[name] = fn; } },
    caches: { keys: async () => ["bloom-v29", "unrelated", "bloom-v30"],
      delete: async (key) => { deleted.push(key); } }
  };
  vm.runInNewContext(source, context);
  let work;
  handlers.activate({ waitUntil(promise) { work = promise; } });
  await work;
  assert.deepEqual(deleted, ["bloom-v29", "unrelated"]);
});

test("runtime config loads before the app and the private seed prefix remains bloom-", () => {
  const root = path.join(__dirname, "..");
  const html = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  assert.ok(html.indexOf('src="/runtime-config.js"') < html.indexOf('src="/app.js"'));
  assert.match(app, /hashStr\("bloom-" \+ SEED_NS \+ key\)/);
  assert.match(app, /window\.BLOOM_SEED_NAMESPACE : ""/);
  assert.match(server, /'window\.BLOOM_SEED_NAMESPACE = "";/);
});
