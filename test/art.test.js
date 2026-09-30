"use strict";

// Guards the expanded art library: earned art must never change, and the v2 set
// must stay broken-free and varied for the long run.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "public", "art.js"), "utf8"), ctx);
const A = ctx.window.BloomArt;

function keyFrom(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

test("already-earned art keeps its exact look", () => {
  assert.equal(A.forDayKey("2026-06-20").title, "Tulips · Posy");
  assert.equal(JSON.stringify(A.forDayKey("2026-06-20")), JSON.stringify(A.forDayKey("2026-06-20")));
});

test("two years of daily art are valid, deterministic, and varied", () => {
  const titles = new Set();
  const start = new Date(Date.UTC(2026, 5, 21)); // first v2 day
  for (let i = 0; i < 730; i += 1) {
    const k = keyFrom(new Date(start.getTime() + i * 86400000));
    const a = A.forDayKey(k);
    assert.ok(a.svg.startsWith("<svg") && !a.svg.includes("undefined"), `broken art on ${k}`);
    assert.equal(a.svg, A.forDayKey(k).svg, `non-deterministic art on ${k}`);
    titles.add(a.title);
  }
  assert.ok(titles.size > 400, `expected lots of variety over 2 years, got ${titles.size}`);
});
