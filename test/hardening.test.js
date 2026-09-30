"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("shipped copy and game code pass the calm-language audit", () => {
  const shipped = ["README.md", "public/index.html", "public/app.js", "public/puzzles.js", "public/styles.css"]
    .map(read).join("\n");
  assert.doesNotMatch(shipped, /streak|timer|countdown|score|brain[- ]?training|therapy|fomo|scarcity|social comparison|dark pattern/i);
  assert.doesNotMatch(read("public/puzzles.js"), /setInterval|setTimeout/);
});

test("every expansion family is in the deterministic Library and synced allowlist", () => {
  const app = read("public/app.js");
  const server = read("server-auth.js");
  const ids = ["matching", "anagram", "wordchain", "crossword", "sudoku", "spot", "memory", "nonogram", "shapefit", "flow", "wordsearch"];
  ids.forEach((id) => {
    assert.match(app, new RegExp(`id: "${id}"`), `${id} missing from Library`);
    assert.match(server, new RegExp(`"${id}"`), `${id} missing from state allowlist`);
  });
  assert.match(app, /"bloom-lib-" \+ family\.id \+ "-" \+ index/);
});

test("every new generator keeps its 2,100-instance stress contract", () => {
  const tests = ["matching", "anagram", "word-chain", "crossword", "sudoku", "spot-difference", "memory", "nonogram", "shape-fit", "flow", "word-search"];
  tests.forEach((name) => assert.match(read(`test/${name}.test.js`), /2100/, `${name} stress sweep is missing`));
});

test("offline shell precaches every runtime asset and uses the final cache", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /const CACHE = "bloom-v\d+"/);
  ["/index.html", "/styles.css", "/app.js", "/puzzles.js", "/art.js", "/auth.js", "/manifest.webmanifest"]
    .forEach((asset) => assert.match(sw, new RegExp(asset.replace(/[/.]/g, "\\$&"))));
});
