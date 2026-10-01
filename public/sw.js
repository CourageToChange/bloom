"use strict";

// Offline-first: Bloom should open and play with no network (a calm ritual must
// be reliable). The whole app is a small static shell + deterministic puzzles, so
// we precache everything and serve cache-first.
const CACHE = "bloom-v30";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/puzzles.js",
  "/art.js",
  "/auth.js",
  "/manifest.webmanifest",
  "/icons/icon.svg",
  "/icons/maskable.svg",
  "/icons/apple-touch-icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only known static shell assets may use Cache Storage. Account, admin,
  // generated and future dynamic routes always go to the origin.
  if (url.origin !== self.location.origin || !SHELL.includes(url.pathname) || (
    /^\/(auth|user|api|admin)(\/|$)/.test(url.pathname) ||
    url.pathname === "/runtime-config.js" || url.pathname === "/health"
  )) {
    e.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }
  // Navigations: serve the cached app shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/index.html")));
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
