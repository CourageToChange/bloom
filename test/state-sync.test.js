"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { installAuth } = require("../server-auth");

const appSource = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");

function accountRoutes() {
  const routes = {};
  const app = {};
  for (const method of ["get", "post", "put", "delete"]) {
    app[method] = (url, ...handlers) => { routes[`${method} ${url}`] = handlers.at(-1); };
  }
  app.use = () => {};
  const state = { users: {}, sessions: {}, invites: [], saves: {} };
  let writes = 0;
  installAuth(app, { loadState: () => state, save: () => { writes += 1; } },
    { accessVerifier: async () => ({ email: "player@example.com" }) });
  function request(method, body) {
    let result;
    routes[`${method} /user/state`](
      { accessUser: { email: "player@example.com" }, headers: {}, body },
      { json(value) { result = value; return this; }, status() { throw new Error("unexpected status"); } }
    );
    return result;
  }
  return { request, state, get writes() { return writes; } };
}

test("two devices retain the more complete day and union gallery and Library", () => {
  const { request } = accountRoutes();
  const fresh = request("put", {
    progress: { "2026-09-30": 3 },
    archive: { "2026-09-30": { artId: "rose", title: "Rose" } },
    favorites: { "2026-09-30": 1 },
    library: { counters: { word: 4 }, effort: { explorer: 4 } }
  });
  assert.equal(fresh.state.progress["2026-09-30"], 3);
  const stale = request("put", {
    progress: { "2026-09-30": 1, "2026-09-29": 2 },
    archive: { "2026-09-29": { artId: "leaf", title: "Leaf" } },
    favorites: { "2026-09-30": 1 },
    library: { counters: { word: 1 } }, depth: "deep"
  });
  assert.deepEqual(stale.state.progress, { "2026-09-30": 3, "2026-09-29": 2 });
  assert.deepEqual(Object.keys(stale.state.archive).sort(), ["2026-09-29", "2026-09-30"]);
  assert.equal(stale.state.favorites["2026-09-30"], 1);
  assert.equal(stale.state.library.counters.word, 4);
  assert.equal(stale.state.library.effort.explorer, 4);
  assert.equal(stale.state.depth, "deep");
  assert.deepEqual(request("get").state, stale.state);
});

test("favourites are a toggle: an un-favourite sticks and is not merged back", () => {
  const { request } = accountRoutes();
  request("put", { favorites: { "2026-09-30": 1, "2026-09-29": 1 } });
  // The player removes one favourite; the device pushes its current set.
  const after = request("put", { favorites: { "2026-09-29": 1 } });
  assert.deepEqual(after.state.favorites, { "2026-09-29": 1 });
  assert.deepEqual(request("get").state.favorites, { "2026-09-29": 1 });
});

test("a single device saves and invalid fields remain sanitized after merging", () => {
  const fixture = accountRoutes();
  const saved = fixture.request("put", {
    progress: { "2026-09-30": 2, invalid: 4, "2026-09-29": 100 },
    favorites: { bad: 1 }, depth: "wrong", sensory: { dark: true, sound: "yes" }
  });
  assert.deepEqual(saved.state.progress, { "2026-09-30": 2 });
  assert.deepEqual(saved.state.favorites, {});
  assert.equal(saved.state.depth, "standard");
  assert.equal(saved.state.sensory.dark, true);
  assert.equal(saved.state.sensory.sound, true);
  assert.equal(fixture.writes, 1);
  assert.deepEqual(fixture.request("get").state, saved.state);
});

async function client({ owner, progress = {}, archive = {}, backup, restore, put } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head><meta name="theme-color"></head><body>
    <div id="topDate"></div><main id="screen"></main>
    <button class="tab" data-tab="today"></button><button class="tab" data-tab="gallery"></button>
    <button class="tab" data-tab="settings"></button></body></html>`,
    { url: "https://bloom.example/", runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;
  const key = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0") + "-" + String(new Date().getDate()).padStart(2, "0");
  if (owner) window.localStorage.setItem("bloom.stateOwner", JSON.stringify(owner));
  window.localStorage.setItem("bloom.progress", JSON.stringify(progress));
  window.localStorage.setItem("bloom.archive", JSON.stringify(archive));
  if (backup) window.localStorage.setItem("bloom.savedState.new@example.com", JSON.stringify(backup));
  window.BloomAuth = { getMe: async () => ({ user: { email: "new@example.com", name: "New" }, enforced: true }) };
  window.BloomArt = { forDayKey: () => ({ id: "rose", title: "Rose", theme: "garden", svg: "<svg></svg>" }), dataUri: () => "data:image/svg+xml,ok" };
  let solve;
  const puzzle = { title: "Test", type: "pattern", rules: "Choose.", hints: [],
    render(_node, events) { solve = events.onSolved; } };
  window.BloomPuzzles = Object.fromEntries(
    ["makePattern", "makeWord", "makeOddOneOut", "makeWordSearch", "makeLogic", "makeAssembly", "makeSymmetry"]
      .map((name) => [name, () => puzzle]));
  const puts = [];
  window.fetch = async (url, options = {}) => {
    if (url === "/user/state" && options.method === "PUT") {
      puts.push(JSON.parse(options.body));
      return put ? put(puts.at(-1)) : { ok: true, json: async () => ({ ok: true, state: puts.at(-1) }) };
    }
    return restore;
  };
  vm.runInContext(appSource, dom.getInternalVMContext());
  await new Promise((resolve) => setImmediate(resolve));
  return { window, key, puts, solve: () => solve() };
}

test("failed restore for a different account clears visible state and cannot upload it", async () => {
  const old = { "2026-09-30": { date: "2026-09-30", artId: "old", title: "Old" } };
  const view = await client({ owner: "old@example.com", progress: { "2026-09-30": 3 }, archive: old,
    restore: { ok: false, json: async () => ({ ok: false }) } });
  assert.deepEqual(JSON.parse(view.window.localStorage.getItem("bloom.progress")), {});
  assert.deepEqual(JSON.parse(view.window.localStorage.getItem("bloom.archive")), {});
  assert.ok(view.window.localStorage.getItem("bloom.savedState.old@example.com"));
  view.window.document.querySelector('[data-tab="settings"]').click();
  const toggle = view.window.document.querySelector('input[aria-label="Dark theme"]');
  toggle.checked = !toggle.checked;
  toggle.dispatchEvent(new view.window.Event("change"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(view.puts[0].progress, {});
  assert.deepEqual(view.puts[0].archive, {});
  view.window.close();
});

test("a successful PUT brings another device's merged progress into local storage", async () => {
  const view = await client({ owner: "new@example.com",
    restore: { ok: true, json: async () => ({ ok: true, state: { progress: {}, archive: {} } }) },
    put: async (sent) => ({ ok: true, json: async () => ({ ok: true, state: {
      ...sent,
      progress: { ...sent.progress, "2026-09-30": 3 },
      archive: { "2026-09-30": { date: "2026-09-30", artId: "remote", title: "Remote" } }
    } }) }) });
  view.window.document.querySelector('[data-tab="settings"]').click();
  const toggle = view.window.document.querySelector('input[aria-label="Dark theme"]');
  toggle.checked = !toggle.checked;
  toggle.dispatchEvent(new view.window.Event("change"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(JSON.parse(view.window.localStorage.getItem("bloom.progress"))["2026-09-30"], 3);
  assert.equal(JSON.parse(view.window.localStorage.getItem("bloom.archive"))["2026-09-30"].artId, "remote");
  view.window.close();
});

test("returning to an account recovers its own saved local progress on failed restore", async () => {
  const view = await client({ owner: "other@example.com", progress: { "2026-09-30": 1 },
    backup: { progress: { "2026-09-29": 2 }, archive: {}, favorites: {}, library: { counters: {}, effort: {} } },
    restore: { ok: false, json: async () => ({ ok: false }) } });
  assert.deepEqual(JSON.parse(view.window.localStorage.getItem("bloom.progress")), { "2026-09-29": 2 });
  assert.equal(JSON.parse(view.window.localStorage.getItem("bloom.stateOwner")), "new@example.com");
  view.window.close();
});

test("final solve stores the gallery entry before the server push or Finish click", async () => {
  const view = await client({ owner: "new@example.com", progress: {},
    restore: { ok: true, json: async () => ({ ok: true, state: { progress: {}, archive: {} } }) } });
  view.window.localStorage.setItem("bloom.progress", JSON.stringify({ [view.key]: 2 }));
  view.window.document.querySelector("#screen .btn").click();
  view.solve();
  const gallery = JSON.parse(view.window.localStorage.getItem("bloom.archive"));
  assert.equal(gallery[view.key].artId, "rose");
  assert.equal(JSON.parse(view.window.localStorage.getItem("bloom.progress"))[view.key], 3);
  assert.equal(view.puts.at(-1).archive[view.key].artId, "rose");
  view.window.close();
});
