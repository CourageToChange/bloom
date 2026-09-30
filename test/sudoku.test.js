"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "public", "puzzles.js"), "utf8");
const context = { window: {}, setTimeout, clearTimeout };
vm.runInNewContext(source, context);
const puzzles = context.window.BloomPuzzles;
function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i += 1) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

test("mini-sudoku generation is deterministic", () => {
  const seed = hashStr("bloom-lib-sudoku-42");
  const a = puzzles.makeSudoku(mulberry32(seed), { difficulty: "deep" }).sudokuModel;
  const b = puzzles.makeSudoku(mulberry32(seed), { difficulty: "deep" }).sudokuModel;
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("2,100 mini-sudokus have exactly one solution and varied grids", () => {
  const instances = new Set();
  const sizes = new Set();
  const depths = ["gentle", "standard", "deep"];
  for (let i = 0; i < 2100; i += 1) {
    const seed = hashStr(`bloom-lib-sudoku-${i}`);
    const model = puzzles.makeSudoku(mulberry32(seed), { difficulty: depths[i % 3] }).sudokuModel;
    assert.equal(puzzles.validateSudoku(model), true, `invalid sudoku ${i}`);
    assert.equal(puzzles.countSudokuSolutions(model.puzzle, model.size, model.boxRows, model.boxCols, 2), 1, `non-unique sudoku ${i}`);
    sizes.add(model.size);
    instances.add(model.size + ":" + model.puzzle.join(""));
  }
  assert.deepEqual(Array.from(sizes).sort(), [4, 6]);
  assert.ok(instances.size > 2000, "expected broad sudoku variety");
});
