"use strict";

// Tiny JSON-file store for Bloom's accounts. Data volume is small (a handful of
// invited users + sessions), so a single atomically-written JSON file is plenty
// — no database/native deps, and it fits the read-only container (only the
// mounted data volume is writable).
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "bloom.json");

function ensureDir() { try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {} }
function defaults() { return { invites: [], users: {}, sessions: {}, saves: {} }; }

let state = null;

function loadState() {
  if (state) return state;
  ensureDir();
  try {
    state = Object.assign(defaults(), JSON.parse(fs.readFileSync(FILE, "utf8")));
  } catch {
    state = defaults();
  }
  // Defensive shape.
  if (!Array.isArray(state.invites)) state.invites = [];
  if (!state.users || typeof state.users !== "object") state.users = {};
  if (!state.sessions || typeof state.sessions !== "object") state.sessions = {};
  if (!state.saves || typeof state.saves !== "object") state.saves = {};
  return state;
}

function save() {
  if (!state) return;
  ensureDir();
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, FILE);
}

module.exports = { loadState, save, DATA_DIR, FILE };
