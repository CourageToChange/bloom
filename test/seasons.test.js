"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("art palettes rotate deterministically through four seasonal collections", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "public", "art.js"), "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context);
  const art = context.window.BloomArt;
  const dates = { winter: "2026-01-15", spring: "2026-04-15", summer: "2026-07-15", autumn: "2026-10-15" };
  for (const [season, key] of Object.entries(dates)) {
    assert.equal(art.seasonForKey(key).id, season);
    assert.equal(art.forDayKey(key).season, season);
    assert.equal(JSON.stringify(art.forDayKey(key)), JSON.stringify(art.forDayKey(key)));
  }
  assert.equal(art.forDayKey("2026-06-20").title, "Tulips · Posy", "previously earned art must keep its original palette");
});

test("seasonal word themes are visible, pressure-free, and passed into play", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
  assert.match(app, /Winter light[\s\S]*wordTheme: "weather"/);
  assert.match(app, /Spring garden[\s\S]*wordTheme: "garden"/);
  assert.match(app, /Summer meadow[\s\S]*wordTheme: "nature"/);
  assert.match(app, /Autumn table[\s\S]*wordTheme: "kitchen"/);
  assert.match(app, /wordTheme: season\.wordTheme/);
  assert.match(app, /nothing expires/);
});
