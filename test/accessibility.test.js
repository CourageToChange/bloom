"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "public", "app.js"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");

test("sensory defaults respect system preferences; gentle feedback is on by default but toggleable", () => {
  assert.match(app, /prefers-color-scheme: dark/);
  assert.match(app, /prefers-reduced-motion: reduce/);
  assert.match(app, /prefers-contrast: more/);
  // Soft completion sound + gentle haptic default ON (a chosen, calm reward) — still
  // fully toggleable, and both feedback paths stay gated behind the setting.
  assert.match(app, /sound: true/);
  assert.match(app, /haptics: true/);
  assert.match(app, /if \(settings\.haptics && navigator\.vibrate\)/);
  assert.match(app, /if \(!settings\.sound\) return/);
});

test("puzzle instructions use compact steps and a visible example", () => {
  assert.match(app, /function howCard\(puzzle\)/);
  assert.match(app, /"How this works"/);
  assert.match(app, /"Example"/);
  assert.equal((app.match(/appendChild\(howCard\(puzzle\)\)/g) || []).length, 2);
});

test("interactive controls have a 44px floor and visible focus", () => {
  assert.match(css, /button \{ min-height: 44px/);
  assert.match(css, /\.switch \{[^}]*height: 44px/s);
  assert.match(css, /button:focus-visible/);
  assert.match(app, /input\.setAttribute\("aria-label", label\)/);
});
