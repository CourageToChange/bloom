"use strict";

// Render-layer smoke test. The other suites prove the GENERATORS are correct
// (solvable / unique / deterministic). This one proves every family's render()
// actually builds DOM without throwing — the crash class that only shows up in a
// browser. We run each family across several seeds AND every depth, then fire all
// its hints. Uses jsdom (dev-only; never shipped to the app).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const pub = path.join(__dirname, "..", "public");
const dom = new JSDOM("<!DOCTYPE html><body></body>", { runScripts: "outside-only", pretendToBeVisual: true });
const ctx = dom.getInternalVMContext();
vm.runInContext(fs.readFileSync(path.join(pub, "art.js"), "utf8"), ctx);
vm.runInContext(fs.readFileSync(path.join(pub, "puzzles.js"), "utf8"), ctx);

const { window } = dom;
const P = window.BloomPuzzles;
const A = window.BloomArt;

function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i += 1) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mirrors app.js LIBRARY_FAMILIES make() wiring so the smoke test exercises the
// exact same call paths the app uses.
const artwork = A.byIndex(0);
const opts = (difficulty) => ({ artwork, theme: artwork.theme, difficulty });
const FAMILIES = {
  wordsearch: (rng, d) => P.makeWordSearch(rng, opts(d)),
  matching: (rng, d) => P.makeMatching(rng, opts(d)),
  anagram: (rng, d) => P.makeAnagram(rng, opts(d)),
  wordchain: (rng, d) => P.makeWordChain(rng, opts(d)),
  crossword: (rng, d) => P.makeCrosswordLite(rng, opts(d)),
  sudoku: (rng, d) => P.makeSudoku(rng, opts(d)),
  spot: (rng, d) => P.makeSpotDifference(rng, opts(d)),
  memory: (rng, d) => P.makeMemory(rng, opts(d)),
  nonogram: (rng, d) => P.makeNonogram(rng, opts(d)),
  shapefit: (rng, d) => P.makeShapeFit(rng, opts(d)),
  flow: (rng, d) => P.makeFlow(rng, opts(d)),
  word: (rng, d) => P.makeWord(rng, opts(d)),
  pattern: (rng) => P.makePattern(rng),
  logic: (rng) => P.makeLogic(rng),
  assembly: (rng) => P.makeAssembly(rng, artwork),
  odd: (rng) => P.makeOddOneOut(rng),
  symmetry: (rng) => P.makeSymmetry(rng)
};
const DEPTHS = ["gentle", "standard", "deep"];

test("art.js and puzzles.js load and expose every Library family", () => {
  assert.ok(A && typeof A.byIndex === "function");
  for (const id of Object.keys(FAMILIES)) {
    assert.equal(typeof FAMILIES[id], "function", `missing wiring for ${id}`);
  }
});

test("every family renders DOM across seeds and depths without throwing", () => {
  for (const id of Object.keys(FAMILIES)) {
    for (const d of DEPTHS) {
      for (let s = 0; s < 6; s += 1) {
        const seed = hashStr(`smoke-${id}-${d}-${s}`);
        let puzzle;
        try { puzzle = FAMILIES[id](mulberry32(seed), d); }
        catch (e) { assert.fail(`make threw for ${id}/${d}/${s}: ${e && e.message}`); }
        assert.ok(puzzle && typeof puzzle.render === "function", `${id} has no render`);
        assert.equal(typeof puzzle.title, "string");
        assert.equal(typeof puzzle.rules, "string");
        assert.ok(Array.isArray(puzzle.hints), `${id} hints not array`);

        const root = window.document.createElement("div");
        let solvedCount = 0;
        try { puzzle.render(root, { onSolved() { solvedCount += 1; } }); }
        catch (e) { assert.fail(`render threw for ${id}/${d}/${s}: ${e && e.stack}`); }
        assert.ok(root.childElementCount > 0, `${id}/${d}/${s} produced no DOM`);

        // Fire every hint level — including board-nudging _applyHint — and ensure
        // no hint path throws. (Some hints legitimately auto-solve the board.)
        try {
          for (let lvl = 1; lvl <= puzzle.hints.length; lvl += 1) {
            if (typeof root._applyHint === "function") root._applyHint(lvl);
          }
        } catch (e) { assert.fail(`_applyHint threw for ${id}/${d}/${s}: ${e && e.stack}`); }
        assert.ok(solvedCount >= 0);
      }
    }
  }
});
