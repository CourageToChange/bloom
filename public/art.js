"use strict";

// Calm artworks for Bloom. Each is a self-contained square SVG (viewBox 0 0 100
// 100) so it can be revealed in the gallery and sliced into tiles for the
// assembly puzzle. Themes rotate across botanical / fine-art / cozy. More can be
// added freely later — the rest of the app just needs the list.
(function () {
  const ART = [
    {
      id: "tulip", title: "Tulip", theme: "botanical",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#eef3ea"/>
        <circle cx="78" cy="22" r="12" fill="#f6e2a8"/>
        <rect x="47" y="48" width="6" height="44" rx="3" fill="#7faa72"/>
        <path d="M50 70 q-22 -4 -28 -22 q24 0 28 22z" fill="#8fbb7e"/>
        <path d="M50 78 q22 -2 30 -18 q-26 -2 -30 18z" fill="#7faa72"/>
        <path d="M50 50 q-16 -2 -16 -20 q0 -14 16 -18 q16 4 16 18 q0 18 -16 20z" fill="#e58fa6"/>
        <path d="M50 50 q-8 -4 -8 -20 q0 -10 8 -16 q8 6 8 16 q0 16 -8 20z" fill="#f0aebf"/>
      </svg>`
    },
    {
      id: "hills", title: "Morning Hills", theme: "fineart",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#f3ead9"/>
        <circle cx="72" cy="30" r="15" fill="#f4c95d"/>
        <path d="M0 70 q25 -22 50 -6 q25 16 50 -4 V100 H0 Z" fill="#c9b88f"/>
        <path d="M0 82 q30 -16 50 -2 q24 12 50 -6 V100 H0 Z" fill="#9bb083"/>
        <path d="M0 92 q28 -10 52 0 q24 8 48 -2 V100 H0 Z" fill="#7d9a6a"/>
      </svg>`
    },
    {
      id: "moon", title: "Quiet Night", theme: "cozy",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#2c3550"/>
        <circle cx="70" cy="28" r="14" fill="#f5efd6"/>
        <circle cx="64" cy="24" r="14" fill="#2c3550"/>
        <g fill="#f5efd6">
          <circle cx="20" cy="20" r="1.4"/><circle cx="38" cy="14" r="1"/>
          <circle cx="28" cy="38" r="1.1"/><circle cx="86" cy="54" r="1.2"/>
          <circle cx="14" cy="58" r="1"/><circle cx="50" cy="30" r="0.9"/>
        </g>
        <path d="M0 78 q30 -12 50 -2 q24 12 50 -4 V100 H0 Z" fill="#3c4767"/>
        <path d="M0 90 q26 -8 50 0 q26 8 50 -2 V100 H0 Z" fill="#4a567c"/>
      </svg>`
    },
    {
      id: "leaf", title: "Leaf Sprig", theme: "botanical",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#eef2f1"/>
        <path d="M50 92 Q50 40 60 14" stroke="#6f9a6a" stroke-width="3" fill="none" stroke-linecap="round"/>
        <g fill="#8bbd7c">
          <path d="M54 74 q18 -4 22 -20 q-20 0 -22 20z"/>
          <path d="M52 58 q-16 -4 -20 -18 q18 0 20 18z"/>
          <path d="M55 42 q16 -4 18 -18 q-18 0 -18 18z"/>
          <path d="M53 30 q-13 -3 -16 -15 q15 0 16 15z"/>
        </g>
      </svg>`
    },
    {
      id: "tea", title: "Warm Cup", theme: "cozy",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#f5ece1"/>
        <path d="M34 36 q3 -10 6 0" stroke="#cdbfae" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M50 34 q3 -10 6 0" stroke="#cdbfae" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <rect x="26" y="44" width="40" height="30" rx="8" fill="#e6a18c"/>
        <path d="M66 50 q14 0 14 12 q0 12 -14 12" stroke="#e6a18c" stroke-width="5" fill="none"/>
        <rect x="22" y="74" width="48" height="6" rx="3" fill="#cf8e79"/>
      </svg>`
    },
    {
      id: "sunflower", title: "Sunflower", theme: "botanical",
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect width="100" height="100" fill="#eaf1ef"/>
        <rect x="47" y="52" width="5" height="42" rx="2.5" fill="#7faa72"/>
        <path d="M50 74 q16 -2 20 -16 q-18 -2 -20 16z" fill="#8fbb7e"/>
        <g fill="#f4c95d">
          ${Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const x = 50 + Math.cos(a) * 20, y = 34 + Math.sin(a) * 20;
            return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="8" ry="4" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
          }).join("")}
        </g>
        <circle cx="50" cy="34" r="11" fill="#7a5230"/>
      </svg>`
    }
  ];

  // ---- Procedural "art of the day" ----------------------------------------
  // A fresh, calm scene generated deterministically from the date, so the daily
  // reveal differs every day for months with no manual art. Scene + palette cycle
  // through 6 x 16 = 96 unique combinations before repeating (~3+ months), and
  // per-day randomness varies the details on top.
  const PALS = [
    { bg: "#eef3ea", a: "#e58fa6", b: "#7faa72", c: "#f4c95d", name: "Meadow", theme: "botanical" },
    { bg: "#f3ead9", a: "#e8a96b", b: "#9bb083", c: "#d98b73", name: "Harvest", theme: "fineart" },
    { bg: "#eaf1ef", a: "#6fa8c7", b: "#8fbb7e", c: "#f0c059", name: "Lakeside", theme: "fineart" },
    { bg: "#f6eef0", a: "#d97b95", b: "#b58fd6", c: "#f2c14e", name: "Posy", theme: "botanical" },
    { bg: "#2c3550", a: "#f5efd6", b: "#6fa8c7", c: "#e9a6b8", name: "Twilight", theme: "cozy" },
    { bg: "#26303a", a: "#9cc78d", b: "#f4c95d", c: "#e8956b", name: "Forest Night", theme: "cozy" },
    { bg: "#f0ece6", a: "#c98b9b", b: "#8aa9a0", c: "#e0b15e", name: "Linen", theme: "fineart" },
    { bg: "#eef2f5", a: "#7e9fd0", b: "#86c0b4", c: "#f1a9a0", name: "Coastal", theme: "fineart" },
    { bg: "#f5efe2", a: "#d98c5f", b: "#a6b977", c: "#caa15a", name: "Terracotta", theme: "botanical" },
    { bg: "#efeaf3", a: "#a98fd6", b: "#86b6c9", c: "#edb1c2", name: "Lavender", theme: "botanical" },
    { bg: "#eaf3ee", a: "#5fb39a", b: "#f0c45e", c: "#e89a86", name: "Mint", theme: "botanical" },
    { bg: "#f4ede6", a: "#cf8e79", b: "#8fae8a", c: "#e6b95e", name: "Clay", theme: "cozy" },
    { bg: "#e9eef2", a: "#6f8fc7", b: "#9ec18a", c: "#f0b45e", name: "Cornflower", theme: "fineart" },
    { bg: "#f6e9ec", a: "#db7f97", b: "#caa0d6", c: "#f3cf6a", name: "Rose", theme: "botanical" },
    { bg: "#1f2630", a: "#e9a6b8", b: "#9cc78d", c: "#f4c95d", name: "Midnight", theme: "cozy" },
    { bg: "#edf1e8", a: "#8aa46e", b: "#d98b73", c: "#e8c25e", name: "Sage", theme: "botanical" },
    // ---- Expanded palettes (v2, from ART_V2_START). Appended, never reordered, so
    // already-earned gallery pieces keep their exact look. Indices 16–39. ----
    { bg: "#e9eef2", a: "#8fb3cf", b: "#b8c6d4", c: "#e0d7c4", name: "Glacier", theme: "fineart" },
    { bg: "#eef2f4", a: "#9bb6c9", b: "#c3d2db", c: "#e7d9c8", name: "Frost", theme: "fineart" },
    { bg: "#232c2e", a: "#8fae9b", b: "#6f93a0", c: "#e3c98f", name: "Pine Dusk", theme: "cozy" },
    { bg: "#f1edf0", a: "#c68fa3", b: "#9fb6c0", c: "#e9c6cf", name: "Snowberry", theme: "botanical" },
    { bg: "#eaf2e7", a: "#7fae74", b: "#a7c98f", c: "#ead99a", name: "Fern", theme: "botanical" },
    { bg: "#f7eef1", a: "#e59ab0", b: "#b9d39a", c: "#f2c98f", name: "Petal", theme: "botanical" },
    { bg: "#ecf3ee", a: "#74b39a", b: "#aecf9c", c: "#f0d27a", name: "Dew", theme: "botanical" },
    { bg: "#eef0f6", a: "#8f9ed6", b: "#a9c8a0", c: "#edc6d2", name: "Bluebell", theme: "botanical" },
    { bg: "#f6f0df", a: "#f0b85e", b: "#a6c07a", c: "#e89a6b", name: "Sunbeam", theme: "fineart" },
    { bg: "#eef4f3", a: "#f09a86", b: "#6fb6ad", c: "#f3cf6a", name: "Coral Bay", theme: "fineart" },
    { bg: "#f5efe0", a: "#e8a14e", b: "#cf8e5f", c: "#9fb56e", name: "Marigold", theme: "botanical" },
    { bg: "#e8f1f1", a: "#5fb0b3", b: "#86c8a0", c: "#f0c45e", name: "Lagoon", theme: "fineart" },
    { bg: "#1f2a33", a: "#8fc7b5", b: "#9aa6e0", c: "#e9b8c6", name: "Aurora", theme: "cozy" },
    { bg: "#f3e8dd", a: "#cf8456", b: "#a08a5e", c: "#d9a94f", name: "Amber Wood", theme: "cozy" },
    { bg: "#eef2ec", a: "#9bbf86", b: "#c2d0a0", c: "#e9b6c0", name: "Meadow Mist", theme: "botanical" },
    { bg: "#f6f1df", a: "#f0c24e", b: "#c9a25a", c: "#8fb27a", name: "Citrine", theme: "fineart" },
    { bg: "#f2e6da", a: "#c87a4f", b: "#9b6f4e", c: "#d9a657", name: "Spice", theme: "cozy" },
    { bg: "#e9f3f0", a: "#6cb8a6", b: "#9cd0c0", c: "#f0c97a", name: "Seafoam", theme: "fineart" },
    { bg: "#f4ecdd", a: "#d09a4e", b: "#a8894f", c: "#b9824f", name: "Ochre", theme: "fineart" },
    { bg: "#f3e7df", a: "#c96f4e", b: "#d99a52", c: "#8f9a5e", name: "Maple", theme: "botanical" },
    { bg: "#f7eee2", a: "#ee9f6b", b: "#d7b06a", c: "#97b682", name: "Apricot", theme: "botanical" },
    { bg: "#efe4d8", a: "#b3744f", b: "#8f6b4e", c: "#cf9a55", name: "Chestnut", theme: "cozy" },
    { bg: "#f5edda", a: "#d6a24e", b: "#a88f56", c: "#c98a52", name: "Goldleaf", theme: "fineart" },
    { bg: "#eaf0f3", a: "#a7c2d4", b: "#cdd9c6", c: "#e9cfd6", name: "Iceflower", theme: "botanical" }
  ];
  const SEASONAL_PALETTE_START = "2026-06-21";
  // Expanded art (more scenes + palettes) begins here so the long run stays fresh;
  // earlier dates keep the original 9-scene / 16-palette look exactly.
  const ART_V2_START = "2026-06-21";
  const LEGACY_SCENES = 9;
  // v2 seasonal palette groups — 10 per season, disjoint, covering all 40 palettes
  // (~20 scenes x 10 = 200 looks per season, ~800 distinct across a year).
  function v2Palettes(month) {
    if (month === 12 || month <= 2) return [4, 5, 6, 14, 16, 17, 18, 19, 28, 39];
    if (month <= 5) return [0, 3, 9, 10, 13, 20, 21, 22, 23, 30];
    if (month <= 8) return [2, 7, 12, 24, 25, 26, 27, 31, 33, 36];
    return [1, 8, 11, 15, 29, 32, 34, 35, 37, 38];
  }

  function rngFrom(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5; let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dayNumber(key) { const p = key.split("-").map(Number); return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function seasonForKey(key) {
    const month = Number(key.split("-")[1]);
    if (month === 12 || month <= 2) return { id: "winter", palettes: [4, 5, 6, 14] };
    if (month <= 5) return { id: "spring", palettes: [0, 3, 9, 10, 13] };
    if (month <= 8) return { id: "summer", palettes: [2, 7, 10, 12] };
    return { id: "autumn", palettes: [1, 8, 11, 15] };
  }

  function flower(cx, cy, r, petals, col, center) {
    let s = "";
    for (let i = 0; i < petals; i += 1) {
      const an = (i / petals) * Math.PI * 2;
      const x = cx + Math.cos(an) * r * 0.62, y = cy + Math.sin(an) * r * 0.62;
      s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(r * 0.5).toFixed(1)}" ry="${(r * 0.28).toFixed(1)}" transform="rotate(${(an * 180 / Math.PI).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${col}"/>`;
    }
    s += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.32).toFixed(1)}" fill="${center}"/>`;
    return s;
  }

  const SCENES = [
    function hills(rng, p) {
      const sx = 22 + rng() * 56, sy = 20 + rng() * 14, sr = 11 + rng() * 6;
      return `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${sr.toFixed(0)}" fill="${p.c}"/>`
        + `<path d="M0 62 q25 -14 50 -5 q25 9 50 -6 V100 H0Z" fill="${p.b}" opacity="0.45"/>`
        + `<path d="M0 76 q30 -14 50 -2 q24 12 50 -7 V100 H0Z" fill="${p.b}" opacity="0.78"/>`
        + `<path d="M0 88 q28 -10 52 0 q24 8 48 -2 V100 H0Z" fill="${p.a}" opacity="0.85"/>`;
    },
    function posy(rng, p) {
      return `<rect x="48" y="55" width="4" height="40" rx="2" fill="${p.b}"/>`
        + flower(34 + rng() * 6, 42 + rng() * 6, 16, 6 + Math.floor(rng() * 3), p.a, p.c)
        + flower(64 - rng() * 6, 46 + rng() * 6, 14, 5 + Math.floor(rng() * 3), p.c, p.a)
        + flower(50 + (rng() * 4 - 2), 34 + rng() * 4, 13, 6, p.b, p.c);
    },
    function bloom(rng, p) {
      const r = 26 + rng() * 6;
      return flower(50, 50, r, 8 + Math.floor(rng() * 4), p.a, p.c)
        + `<g opacity="0.6">` + flower(50, 50, r * 0.6, 8, p.c, p.a) + `</g>`;
    },
    function ripples(rng, p) {
      let s = ""; const cx = 30 + rng() * 40, cy = 30 + rng() * 40, cols = [p.a, p.b, p.c];
      for (let i = 5; i >= 1; i -= 1) s += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(i * 14).toFixed(0)}" fill="${cols[i % 3]}" opacity="0.22"/>`;
      return s;
    },
    function leaves(rng, p) {
      let s = `<path d="M50 96 Q50 40 ${(56 + rng() * 8).toFixed(0)} 14" stroke="${p.b}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < 5; i += 1) {
        const y = 72 - i * 12, left = i % 2 === 0;
        s += `<path d="M${left ? 52 : 48} ${y} q${left ? 18 : -18} -5 ${left ? 22 : -22} -16 q${left ? -20 : 20} 0 ${left ? -22 : 22} 16z" fill="${i % 2 ? p.a : p.b}" opacity="0.9"/>`;
      }
      return s;
    },
    function tulips(rng, p) {
      let s = "";
      for (let i = 0; i < 3; i += 1) {
        const x = 30 + i * 20 + (rng() * 4 - 2);
        s += `<rect x="${(x - 1.5).toFixed(1)}" y="48" width="3" height="44" rx="1.5" fill="${p.b}"/>`;
        s += `<path d="M${x.toFixed(1)} 50 q-9 -2 -9 -14 q0 -8 9 -12 q9 4 9 12 q0 12 -9 14z" fill="${i === 1 ? p.c : p.a}"/>`;
      }
      return s;
    },
    function moonrise(rng, p) {
      const mx = 58 + rng() * 22, my = 20 + rng() * 8;
      let s = `<circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="12" fill="${p.c}" opacity="0.92"/>`;
      for (let i = 0; i < 5; i += 1) s += `<circle cx="${(10 + rng() * 80).toFixed(0)}" cy="${(8 + rng() * 30).toFixed(0)}" r="${rng() > 0.6 ? 1.4 : 1}" fill="${p.c}" opacity="0.8"/>`;
      s += `<path d="M0 80 q26 -12 50 -2 q24 10 50 -6 V100 H0Z" fill="${p.a}" opacity="0.85"/>`;
      return s;
    },
    function branch(rng, p) {
      let s = `<path d="M8 92 Q40 60 92 18" stroke="${p.b}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      for (let i = 0; i < 5; i += 1) { const t = 0.2 + i * 0.16, x = 8 + 84 * t, y = 92 - 74 * t; s += flower(x, y, 8, 5, p.a, p.c); }
      return s;
    },
    function waves(rng, p) {
      const cols = [p.a, p.b, p.c]; let s = "";
      for (let i = 0; i < 4; i += 1) { const y = 30 + i * 18 + rng() * 3; s += `<path d="M0 ${y.toFixed(0)} q25 -8 50 0 q25 8 50 0 V100 H0Z" fill="${cols[i % 3]}" opacity="0.3"/>`; }
      return s;
    },
    // ---- Expanded scenes (v2). Appended after the first 9 so earned art is stable. ----
    function meadow(rng, p) {
      let s = `<path d="M0 70 q25 -8 50 0 q25 8 50 0 V100 H0Z" fill="${p.b}" opacity="0.5"/>`;
      for (let i = 0; i < 5; i += 1) { const x = 12 + i * 19 + (rng() * 6 - 3), y = 64 + rng() * 8; s += `<rect x="${(x - 1).toFixed(1)}" y="${y.toFixed(1)}" width="2" height="${(92 - y).toFixed(1)}" fill="${p.b}"/>` + flower(x, y, 7, 5, i % 2 ? p.a : p.c, p.bg); }
      return s;
    },
    function sunburst(rng, p) {
      const cx = 50, cy = 46; let s = `<circle cx="${cx}" cy="${cy}" r="14" fill="${p.c}"/>`;
      for (let i = 0; i < 12; i += 1) { const an = (i / 12) * Math.PI * 2; s += `<line x1="${(cx + Math.cos(an) * 20).toFixed(1)}" y1="${(cy + Math.sin(an) * 20).toFixed(1)}" x2="${(cx + Math.cos(an) * 32).toFixed(1)}" y2="${(cy + Math.sin(an) * 32).toFixed(1)}" stroke="${p.a}" stroke-width="2.5" stroke-linecap="round" opacity="0.7"/>`; }
      return s;
    },
    function lily(rng, p) {
      let s = `<rect width="100" height="100" fill="${p.b}" opacity="0.12"/>`;
      for (let i = 5; i >= 1; i -= 1) s += `<circle cx="70" cy="30" r="${(i * 4).toFixed(0)}" fill="none" stroke="${p.c}" stroke-width="0.6" opacity="0.3"/>`;
      for (let i = 0; i < 3; i += 1) { const x = 24 + i * 26 + (rng() * 6 - 3), y = 56 + rng() * 22; s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="13" ry="8" fill="${p.b}" opacity="0.7"/>` + flower(x, y - 1, 8, 6, p.a, p.c); }
      return s;
    },
    function peaks(rng, p) {
      const sx = 24 + rng() * 52;
      return `<circle cx="${sx.toFixed(0)}" cy="24" r="9" fill="${p.c}"/>`
        + `<path d="M0 70 L26 38 L48 70 Z" fill="${p.a}" opacity="0.8"/>`
        + `<path d="M34 74 L62 34 L90 74 Z" fill="${p.b}" opacity="0.85"/>`
        + `<path d="M0 86 q30 -10 50 0 q24 8 50 -2 V100 H0Z" fill="${p.b}" opacity="0.6"/>`;
    },
    function rows(rng, p) {
      let s = "";
      for (let i = 0; i < 4; i += 1) { const y = 52 + i * 12; s += `<path d="M0 ${y} q50 -6 100 0" stroke="${p.b}" stroke-width="3" fill="none" opacity="0.6"/>`; for (let j = 0; j < 5; j += 1) { const x = 14 + j * 18 + (rng() * 4 - 2); s += flower(x, y - 2, 4, 5, (i + j) % 2 ? p.a : p.c, p.bg); } }
      return s;
    },
    function petalfall(rng, p) {
      let s = `<path d="M70 8 Q40 30 20 70" stroke="${p.b}" stroke-width="2.5" fill="none" opacity="0.5"/>`;
      for (let i = 0; i < 14; i += 1) { const x = 8 + rng() * 84, y = 10 + rng() * 84; s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.4" ry="1.8" transform="rotate(${(rng() * 180).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="${i % 2 ? p.a : p.c}" opacity="0.85"/>`; }
      return s;
    },
    function starnight(rng, p) {
      const mx = 24 + rng() * 16; let s = `<circle cx="${mx.toFixed(0)}" cy="26" r="11" fill="${p.c}"/><circle cx="${(mx + 5).toFixed(0)}" cy="24" r="9" fill="${p.bg}"/>`;
      for (let i = 0; i < 10; i += 1) s += `<circle cx="${(10 + rng() * 84).toFixed(0)}" cy="${(8 + rng() * 54).toFixed(0)}" r="${rng() > 0.7 ? 1.4 : 0.9}" fill="${p.a}" opacity="0.85"/>`;
      s += `<path d="M0 82 q30 -8 50 0 q24 6 50 -2 V100 H0Z" fill="${p.b}" opacity="0.8"/>`;
      return s;
    },
    function potted(rng, p) {
      let s = `<path d="M40 72 H60 L57 92 H43 Z" fill="${p.a}"/><rect x="48.5" y="44" width="3" height="30" fill="${p.b}"/>`;
      for (let i = 0; i < 4; i += 1) { const left = i % 2 === 0, y = 68 - i * 9; s += `<path d="M50 ${y} q${left ? 16 : -16} -3 ${left ? 20 : -20} -14 q${left ? -18 : 18} 0 ${left ? -20 : 20} 14z" fill="${i % 2 ? p.a : p.b}" opacity="0.9"/>`; }
      return s + flower(50, 40, 8, 6, p.c, p.a);
    },
    function wheat(rng, p) {
      let s = "";
      for (let i = 0; i < 5; i += 1) { const x = 20 + i * 15 + (rng() * 4 - 2); s += `<line x1="${x.toFixed(1)}" y1="94" x2="${x.toFixed(1)}" y2="40" stroke="${p.b}" stroke-width="2"/>`; for (let j = 0; j < 6; j += 1) { const y = 44 + j * 7; s += `<ellipse cx="${(x - 3).toFixed(1)}" cy="${y}" rx="3" ry="1.6" transform="rotate(40 ${x.toFixed(1)} ${y})" fill="${p.c}"/><ellipse cx="${(x + 3).toFixed(1)}" cy="${y}" rx="3" ry="1.6" transform="rotate(-40 ${x.toFixed(1)} ${y})" fill="${p.c}"/>`; } }
      return s;
    },
    function clouds(rng, p) {
      const sx = 64 + rng() * 16; let s = `<circle cx="${sx.toFixed(0)}" cy="28" r="12" fill="${p.c}" opacity="0.9"/>`;
      for (let i = 0; i < 3; i += 1) { const x = 18 + i * 30 + (rng() * 8 - 4), y = 40 + i * 14; s += `<g opacity="0.8"><ellipse cx="${x.toFixed(1)}" cy="${y}" rx="16" ry="8" fill="${p.a}"/><ellipse cx="${(x + 12).toFixed(1)}" cy="${y}" rx="11" ry="7" fill="${p.a}"/><ellipse cx="${(x - 12).toFixed(1)}" cy="${y}" rx="11" ry="7" fill="${p.a}"/></g>`; }
      return s;
    },
    function arcs(rng, p) {
      const cols = [p.a, p.b, p.c]; let s = "";
      for (let i = 0; i < 3; i += 1) { const r = 28 - i * 6; s += `<path d="M${50 - r} 80 A ${r} ${r} 0 0 1 ${50 + r} 80" stroke="${cols[i % 3]}" stroke-width="6" fill="none" opacity="0.55" stroke-linecap="round"/>`; }
      return s;
    }
  ];
  const SCENE_TITLES = ["Hills", "Posy", "Bloom", "Ripples", "Leaf Sprig", "Tulips", "Moonrise", "Blossom Branch", "Calm Waves",
    "Meadow", "Sunburst", "Lily Pond", "Mountains", "Garden Rows", "Petal Fall", "Starry Night", "Potted Plant", "Wheat Field", "Soft Clouds", "Rainbow Arcs"];

  function forDayKey(key) {
    const dn = dayNumber(key);
    const rng = rngFrom("art-" + key);
    const season = seasonForKey(key);
    const v2 = key >= ART_V2_START;
    // Earlier dates: original 9 scenes + first 16 palettes (so earned art is stable).
    // From ART_V2_START: 20 scenes + 40 palettes in seasonal groups (the long-run set).
    const sceneCount = v2 ? SCENES.length : LEGACY_SCENES;
    const scene = ((dn % sceneCount) + sceneCount) % sceneCount;
    let pal;
    if (v2) {
      const list = v2Palettes(Number(key.split("-")[1]));
      pal = PALS[list[((Math.floor(dn / sceneCount) % list.length) + list.length) % list.length]];
    } else {
      pal = PALS[((Math.floor(dn / sceneCount) % 16) + 16) % 16];
    }
    const inner = SCENES[scene](rng, pal);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"><rect width="100" height="100" fill="${pal.bg}"/>${inner}</svg>`;
    return { id: key, title: `${SCENE_TITLES[scene]} · ${pal.name}`, theme: pal.theme, season: season.id, svg };
  }

  function dataUri(svg) {
    return "data:image/svg+xml," + encodeURIComponent(svg);
  }
  function byIndex(i) {
    const n = ART.length;
    return ART[((i % n) + n) % n];
  }

  window.BloomArt = { ART, dataUri, byIndex, forDayKey, seasonForKey };
})();
