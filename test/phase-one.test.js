"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
const index = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const puzzles = fs.readFileSync(path.join(root, "public", "puzzles.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "public", "styles.css"), "utf8");
const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");

test("navigation keeps Today, More, Gallery, Settings in stable order", () => {
  const tabs = Array.from(index.matchAll(/data-tab="([^"]+)"/g), (match) => match[1]);
  assert.deepEqual(tabs, ["today", "more", "gallery", "settings"]);
});

test("daily Word Search receives the day's artwork without growing the pack", () => {
  assert.match(app, /makeWordSearch\(rng, \{ artwork, theme: artwork\.theme, wordTheme: season\.wordTheme, difficulty: depth \}\)/);
  assert.match(app, /const puzzles = \[warm, window\.BloomPuzzles\.makeLogic\(rng, \{ difficulty: depth \}\), finish\]/);
});

test("Library uses the approved deterministic seed and all Phase 1 families", () => {
  assert.match(app, /"bloom-lib-" \+ family\.id \+ "-" \+ index/);
  for (const family of ["wordsearch", "word", "pattern", "logic", "assembly", "odd", "symmetry"]) {
    assert.match(app, new RegExp(`id: "${family}"`));
  }
});

test("completion offers three equal calm choices", () => {
  for (const label of ["More like this", "Something different", "Finish here"]) {
    assert.match(app, new RegExp(`"btn continuation-choice", "${label}"`));
  }
  assert.match(app, /"calm-link", "See today's artwork in your gallery"/);
  assert.match(app, /"calm-link", "Play again, just for fun"/);
});

test("Word Search supports drag and tap-two-ends without page gestures", () => {
  assert.match(puzzles, /addEventListener\("pointerdown"/);
  assert.match(puzzles, /addEventListener\("pointermove", moveDrag\)/);
  assert.match(puzzles, /tapCell\(\{ row, col \}\)/);
  assert.match(styles, /\.ws-grid[\s\S]*?touch-action: none/);
});

test("service worker refreshes every changed shell asset", () => {
  assert.match(sw, /const CACHE = "bloom-v\d+"/);
  for (const asset of ["/index.html", "/styles.css", "/app.js", "/puzzles.js"]) {
    assert.ok(sw.includes(`"${asset}"`), `${asset} must stay in the offline shell`);
  }
});
