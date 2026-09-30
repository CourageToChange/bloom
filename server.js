"use strict";

// Bloom server. Serves the static PWA + a small invite-only account layer
// (Google sign-in, verified server-side; access limited to an email allowlist).
// Matches the snake/portfolio deploy pattern: hardened container behind a
// Cloudflare Tunnel. Cloudflare Access identity is always verified at the
// origin; Google sign-in remains the invite/session layer when configured.

const express = require("express");
const path = require("path");
const store = require("./store");
const { installAuth } = require("./server-auth");
const { accessConfigFromEnv, createAccessJwtVerifier } = require("./access-jwt");

const app = express();
const PORT = Number(process.env.PORT || 4000);
const DEMO_MODE = readDemoMode(process.env.DEMO_MODE);
// The private app REQUIRES Access config and refuses to boot without it — that fail-closed
// behaviour is deliberate and unchanged. The anonymous demo has no identity to verify, so it
// builds no verifier at all rather than being handed config it would never use. Building one
// here would also mean a half-configured demo could silently expect JWTs it can never receive.
const accessVerifier = DEMO_MODE ? null : createAccessJwtVerifier(accessConfigFromEnv(process.env));

function readDemoMode(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized || normalized === "false") return false;
  if (normalized === "true") return true;
  throw new Error("DEMO_MODE must be true or false");
}

app.set("trust proxy", true); // behind cloudflared: trust X-Forwarded-Proto / IP
app.use(express.json({ limit: "128kb" }));

// Security headers. The private app must allow Google Identity Services for sign-in; the public
// demo has no sign-in at all (no client id, no accounts), so it gets a strictly tighter policy —
// no third-party script/frame/connect origins whatsoever. A demo that cannot talk to anything is
// a demo that cannot be turned into a proxy for something else.
const CSP_DEMO = [
  "default-src 'self'",
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader(
    "Content-Security-Policy",
    DEMO_MODE ? CSP_DEMO : [
      "default-src 'self'",
      "img-src 'self' data: https://*.googleusercontent.com",
      "style-src 'self' 'unsafe-inline' https://accounts.google.com",
      "script-src 'self' https://accounts.google.com/gsi/client",
      "connect-src 'self' https://accounts.google.com",
      "frame-src 'self' https://accounts.google.com",
      "manifest-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'"
    ].join("; ")
  );
  next();
});

// The public demo is a read-only showcase. Keep this middleware ahead of every
// application route so current and future unsafe methods cannot reach a write
// handler. Browser-local puzzle play remains available through GET/static paths.
if (DEMO_MODE) {
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
    res.setHeader("Cache-Control", "no-store");
    return res.status(403).json({ ok: false, error: "The public demo is read-only." });
  });
}

// Mutating routes are blocked above. The read-only store facade also prevents
// incidental maintenance from a read route (such as expired-session cleanup)
// from persisting changes to the shared demo seed.
const appStore = DEMO_MODE ? { ...store, save() {} } : store;
installAuth(app, appStore, { accessVerifier, demoMode: DEMO_MODE });

app.get("/health", (_req, res) => res.json({ ok: true }));

// Runtime config, generated rather than shipped as a static file so one codebase serves both
// builds. The only thing it carries today is the seed namespace: the public demo salts every
// puzzle seed so a reviewer never sees the same daily set the private app's players are working through, which is
// what "the public and personal Bloom should have different puzzles" asks for. Empty string in
// the private app, so the private daily ritual is bit-for-bit unchanged.
app.get("/runtime-config.js", (_req, res) => {
  res.type("application/javascript");
  res.setHeader("Cache-Control", "no-cache");
  res.send(
    DEMO_MODE
      ? 'window.BLOOM_SEED_NAMESPACE = "demo-";\nwindow.BLOOM_DEMO = true;\n'
      : 'window.BLOOM_SEED_NAMESPACE = "";\nwindow.BLOOM_DEMO = false;\n'
  );
});

app.use(express.static(path.join(__dirname, "public"), {
  setHeaders(res, filePath) {
    if (filePath.endsWith("sw.js")) res.setHeader("Cache-Control", "no-cache");
  }
}));

function startServer(port = PORT) {
  return app.listen(port, () => console.log(`Bloom running at http://localhost:${port}`));
}

if (require.main === module) startServer();

module.exports = { app, startServer };
