"use strict";

// Bloom invite-only accounts. Google Sign-In only: the client posts a Google
// ID-token credential, we verify it against Google server-side, then allow the
// session ONLY if the verified email is the admin or on the invite allowlist.
// Sessions are random tokens stored as hashes; cookies are HttpOnly/SameSite/
// Secure. Admins (BLOOM_ADMIN_EMAILS) manage invites in-app.
const crypto = require("crypto");
const { createAccessJwtMiddleware } = require("./access-jwt");

const DEFAULT_GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "").trim();
const DEFAULT_ADMIN_EMAILS = String(process.env.BLOOM_ADMIN_EMAILS || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const SESSION_COOKIE = "bloom_session";
const SESSION_DAYS = 60;
const GOOGLE_VERIFY_TIMEOUT_MS = 5000;
const MAX_INVITES = 100;

function installAuth(app, store, options = {}) {
  const GOOGLE_CLIENT_ID = options.googleClientId === undefined
    ? DEFAULT_GOOGLE_CLIENT_ID
    : String(options.googleClientId || "").trim();
  const ADMIN_EMAILS = options.adminEmails === undefined
    ? DEFAULT_ADMIN_EMAILS
    : options.adminEmails.map((email) => normalizeEmail(email)).filter(Boolean);
  // The public demo is anonymous by design, so it cannot require a Cloudflare Access
  // JWT — there is no signed-in visitor to produce one. This exemption is safe ONLY
  // because DEMO_MODE (see server.js) already rejects every non-GET/HEAD/OPTIONS request
  // with 403 from middleware placed ahead of every application route, AND stubs the
  // store's save(), so an unauthenticated visitor can neither write nor persist anything.
  //
  // Note this yields a genuinely anonymous request, not a half-authenticated one:
  // userFromRequest() finds no req.accessUser, falls through to the session path, finds
  // no token, and returns null. So /auth/me reports "not signed in" rather than 401.
  //
  // When demoMode is false this is EXACTLY the previous behaviour — verified by test.
  const demoMode = options.demoMode === true;
  const requireAccessJwt = demoMode
    ? (_req, _res, next) => next()
    : createAccessJwtMiddleware(options.accessVerifier);
  const state = store.loadState();
  const attempts = new Map();

  app.get("/auth/config", (_req, res) => {
    // Tells the client whether sign-in is configured (and thus invite-only is on).
    res.json({ ok: true, googleClientId: GOOGLE_CLIENT_ID || null, enforced: !!GOOGLE_CLIENT_ID });
  });

  app.get("/auth/me", requireAccessJwt, (req, res) => {
    res.json({ ok: true, user: userFromRequest(req), enforced: !!GOOGLE_CLIENT_ID });
  });

  app.post("/auth/logout", (req, res) => {
    const t = readToken(req);
    if (t && state.sessions[hashToken(t)]) { delete state.sessions[hashToken(t)]; store.save(); }
    clearCookie(req, res);
    res.json({ ok: true });
  });

  app.post("/auth/google", limitRate(attempts, 15, 5 * 60 * 1000), async (req, res) => {
    if (!GOOGLE_CLIENT_ID) return res.status(503).json({ ok: false, error: "Sign-in is not set up yet." });
    const credential = String(req.body && req.body.credential || "");
    if (!credential || credential.length > 4096) return res.status(400).json({ ok: false, error: "Missing credential." });

    let profile = null;
    try { profile = await verifyGoogleToken(credential, GOOGLE_CLIENT_ID); } catch { profile = null; }
    if (!profile) return res.status(401).json({ ok: false, error: "Google sign-in failed." });

    // The invite gate.
    if (!isAllowed(profile.email)) {
      return res.status(403).json({ ok: false, error: "Bloom is invite-only. Ask the owner to add your email." });
    }

    cleanSessions();
    const prev = state.users[profile.sub] || {};
    state.users[profile.sub] = {
      sub: profile.sub,
      email: profile.email,
      name: prev.name || profile.name || profile.email.split("@")[0],
      createdAt: prev.createdAt || nowIso()
    };
    const token = crypto.randomBytes(32).toString("base64url");
    state.sessions[hashToken(token)] = { sub: profile.sub, expires: Date.now() + SESSION_DAYS * 864e5 };
    store.save();
    setCookie(req, res, token);
    res.json({ ok: true, user: publicUser(state.users[profile.sub]) });
  });

  // ----- Admin: manage the invite allowlist (admin session required) --------
  app.use("/admin", requireAccessJwt);
  function requireAdmin(req, res, next) {
    const u = userFromRequest(req);
    if (!u || !u.isAdmin) return res.status(403).json({ ok: false, error: "Admin only." });
    next();
  }
  app.get("/admin/invites", requireAdmin, (_req, res) => {
    res.json({ ok: true, invites: state.invites.slice(), admins: ADMIN_EMAILS.slice() });
  });
  app.post("/admin/invites", requireAdmin, (req, res) => {
    const email = normalizeEmail(req.body && req.body.email);
    if (!email) return res.status(400).json({ ok: false, error: "Enter a valid email." });
    if (state.invites.length >= MAX_INVITES) return res.status(403).json({ ok: false, error: "Invite list is full." });
    if (!state.invites.includes(email) && !ADMIN_EMAILS.includes(email)) { state.invites.push(email); store.save(); }
    res.json({ ok: true, invites: state.invites.slice() });
  });
  app.delete("/admin/invites", requireAdmin, (req, res) => {
    const email = normalizeEmail(req.body && req.body.email);
    state.invites = state.invites.filter((e) => e !== email);
    store.save();
    res.json({ ok: true, invites: state.invites.slice() });
  });

  // ----- per-account saved state (progress + gallery) -----------------------
  // Keyed by the user's email so each person has their own gallery that follows
  // them across devices. Works for both the Google and Cloudflare Access paths.
  app.use("/user", requireAccessJwt);
  app.get("/user/state", (req, res) => {
    const u = userFromRequest(req);
    if (!u) return res.status(401).json({ ok: false, error: "Sign in required." });
    res.json({ ok: true, state: state.saves[u.email] || null });
  });
  app.put("/user/state", (req, res) => {
    const u = userFromRequest(req);
    if (!u) return res.status(401).json({ ok: false, error: "Sign in required." });
    state.saves[u.email] = sanitizeUserState(req.body || {});
    store.save();
    res.json({ ok: true });
  });

  // ----- closure helpers ----------------------------------------------------
  function isAllowed(email) { return ADMIN_EMAILS.includes(email) || state.invites.includes(email); }
  function publicUser(u) { return u ? { email: u.email, name: u.name, isAdmin: ADMIN_EMAILS.includes(u.email) } : null; }
  function userFromRequest(req) {
    // Cloudflare Access path: the route middleware has verified the signed Access
    // assertion and attached the identity from its claims. Plaintext identity
    // headers are deliberately never consulted.
    const accessEmail = normalizeEmail(req.accessUser && req.accessUser.email);
    if (accessEmail) {
      let known = null;
      for (const k of Object.keys(state.users)) { if (state.users[k].email === accessEmail) { known = state.users[k]; break; } }
      return { email: accessEmail, name: (known && known.name) || accessEmail.split("@")[0], isAdmin: ADMIN_EMAILS.includes(accessEmail) };
    }
    cleanSessions();
    const t = readToken(req);
    if (!t) return null;
    const s = state.sessions[hashToken(t)];
    if (!s || s.expires <= Date.now()) return null;
    return publicUser(state.users[s.sub]);
  }
  function cleanSessions() {
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(state.sessions)) {
      if (state.sessions[k].expires <= now) { delete state.sessions[k]; changed = true; }
    }
    if (changed) store.save();
  }

  return { userFromRequest };
}

// ----- stateless helpers ----------------------------------------------------
async function verifyGoogleToken(credential, clientId) {
  if (typeof fetch !== "function") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_VERIFY_TIMEOUT_MS);
  let res;
  try {
    res = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credential), { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;
  const iss = String(data.iss || "");
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
  if (String(data.aud || "") !== clientId) return null;
  if (String(data.email_verified) !== "true") return null;
  const exp = Number(data.exp || 0);
  if (!exp || exp * 1000 <= Date.now()) return null;
  const sub = String(data.sub || "");
  const email = normalizeEmail(data.email);
  if (!sub || !email) return null;
  return { sub, email, name: data.name };
}

function sanitizeUserState(body) {
  const out = { progress: {}, archive: {}, library: { counters: {}, effort: {} }, favorites: {}, depth: "standard", sensory: { calmPalette: true, sound: true, haptics: true } };
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (body.progress && typeof body.progress === "object") {
    let n = 0;
    for (const k of Object.keys(body.progress)) {
      if (n++ > 2000) break;
      if (!dateRe.test(k)) continue;
      const v = Number(body.progress[k]);
      if (Number.isFinite(v) && v >= 0 && v <= 20) out.progress[k] = Math.floor(v);
    }
  }
  if (body.archive && typeof body.archive === "object") {
    let n = 0;
    for (const k of Object.keys(body.archive)) {
      if (n++ > 2000) break;
      if (!dateRe.test(k)) continue;
      const e = body.archive[k] || {};
      out.archive[k] = {
        date: String(e.date || k).slice(0, 12),
        artId: String(e.artId || "").slice(0, 40),
        title: String(e.title || "").slice(0, 60),
        theme: String(e.theme || "").slice(0, 30)
      };
    }
  }
  if (body.favorites && typeof body.favorites === "object") {
    let n = 0;
    for (const k of Object.keys(body.favorites)) {
      if (n++ > 2000) break;
      if (dateRe.test(k) && body.favorites[k]) out.favorites[k] = 1;
    }
  }
  const families = new Set(["wordsearch", "matching", "anagram", "wordchain", "crossword", "sudoku", "spot", "memory", "nonogram", "shapefit", "flow", "word", "pattern", "logic", "assembly", "odd", "symmetry"]);
  const counters = body.library && body.library.counters;
  if (counters && typeof counters === "object") {
    for (const family of Object.keys(counters)) {
      if (!families.has(family)) continue;
      const value = Number(counters[family]);
      if (Number.isFinite(value) && value >= 0 && value <= 1000000) {
        out.library.counters[family] = Math.floor(value);
      }
    }
  }
  const effort = body.library && body.library.effort;
  const effortKeys = new Set(["explorer", "wordGardener", "patternFinisher", "quietCollector", "logicTender"]);
  if (effort && typeof effort === "object") {
    for (const key of Object.keys(effort)) {
      if (!effortKeys.has(key)) continue;
      const value = Number(effort[key]);
      if (Number.isFinite(value) && value >= 0 && value <= 1000000) out.library.effort[key] = Math.floor(value);
    }
  }
    if (["gentle", "standard", "deep"].includes(body.depth)) out.depth = body.depth;
    if (body.sensory && typeof body.sensory === "object") {
      // calmPalette/sound/haptics have safe defaults; the display prefs (dark,
      // reduceMotion, contrast, largeText) are only stored once the user sets
      // them, so a fresh account still honours the device's OS preferences.
      for (const key of ["calmPalette", "sound", "haptics", "dark", "reduceMotion", "contrast", "largeText"]) {
        if (typeof body.sensory[key] === "boolean") out.sensory[key] = body.sensory[key];
      }
    }
    return out;
}

function normalizeEmail(email) {
  const v = String(email || "").trim().toLowerCase();
  if (v.length < 3 || v.length > 254) return "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return "";
  return v;
}
function hashToken(t) { return crypto.createHash("sha256").update(t).digest("hex"); }
function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i <= 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function readToken(req) { return parseCookies(req.headers.cookie || "")[SESSION_COOKIE] || ""; }
function isSecure(req) {
  return req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
}
function setCookie(req, res, token) {
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5);
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Expires=${exp.toUTCString()}${isSecure(req) ? "; Secure" : ""}`);
}
function clearCookie(req, res) {
  res.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${isSecure(req) ? "; Secure" : ""}`);
}
function nowIso() { return new Date().toISOString(); }
function limitRate(map, max, windowMs) {
  return (req, res, next) => {
    const key = String(req.headers["cf-connecting-ip"] || req.ip || "unknown").split(",")[0].trim();
    const now = Date.now();
    const b = map.get(key) || { count: 0, resetAt: now + windowMs };
    if (b.resetAt <= now) { b.count = 0; b.resetAt = now + windowMs; }
    b.count += 1;
    map.set(key, b);
    if (b.count > max) return res.status(429).json({ ok: false, error: "Too many attempts. Try again shortly." });
    next();
  };
}

module.exports = { installAuth, sanitizeUserState };
