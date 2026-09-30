"use strict";

// Guards the app-shell scroll contract. The shell is a fixed-height grid
// (header / scrolling screen / tab bar). Two rules are load-bearing: the shell
// must be a definite height (so it doesn't grow past the viewport), and the
// scrolling middle row needs `min-height: 0` (so a grid 1fr child scrolls
// internally instead of pushing content off-screen). Losing either re-breaks
// scrolling on the phone, which automation otherwise can't see.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const css = fs.readFileSync(path.join(__dirname, "..", "public", "styles.css"), "utf8");

function block(selector) {
  // A selector can appear in more than one rule (e.g. .screen); collect them all.
  // Multiline so a rule that starts a line is matched even after a comment.
  const re = new RegExp("^\\s*" + selector.replace(".", "\\.") + "\\s*\\{([^}]*)\\}", "gm");
  let m, out = "";
  while ((m = re.exec(css)) !== null) out += m[1] + " ";
  return out;
}

test(".app is a definite-height grid shell", () => {
  const app = block(".app");
  assert.match(app, /display:\s*grid/);
  assert.match(app, /grid-template-rows:\s*auto\s+1fr\s+auto/);
  assert.match(app, /height:\s*100svh/, ".app must use a fixed height (height:100svh), not min-height");
});

test(".screen can scroll internally", () => {
  const screen = block(".screen");
  assert.match(screen, /min-height:\s*0/, ".screen needs min-height:0 so the 1fr row scrolls");
  assert.match(screen, /overflow-y:\s*auto/);
});
