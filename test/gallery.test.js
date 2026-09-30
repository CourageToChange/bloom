"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");

test("gallery groups daily art into monthly folios", () => {
  assert.match(app, /function monthLabel\(monthKey\)/);
  assert.match(app, /key\.slice\(0, 7\)/);
  assert.match(app, /el\("section", "folio"\)/);
});

test("gallery supports favourites and saving artwork", () => {
  assert.match(app, /function toggleFavorite\(key\)/);
  assert.match(app, /♥ Favourites/);
  assert.match(app, /function saveArtwork\(artwork/);
  assert.match(app, /navigator\.canShare/);
});

test("Library completion only adds cumulative effort", () => {
  for (const key of ["explorer", "wordGardener", "patternFinisher", "quietCollector", "logicTender"]) assert.ok(app.includes(key));
  assert.match(app, /library\.effort\.explorer = Math\.max\(0, Number\(library\.effort\.explorer\) \|\| 0\) \+ 1/);
  assert.match(app, /Taking time away never changes them/);
});
