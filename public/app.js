"use strict";

// Bloom app shell. Everything runs locally: today's pack is generated
// deterministically from the date, progress + settings + the art gallery live in
// localStorage (private, offline). Finishing a day reveals an artwork into the
// gallery, and missing a day costs nothing.
(function () {
  const screen = document.getElementById("screen");
  const topDate = document.getElementById("topDate");
  const tabs = Array.from(document.querySelectorAll(".tab"));

  // ---- storage helpers ----------------------------------------------------
  const KEY = {
    settings: "bloom.settings",
    depth: "bloom.depth",
    progress: "bloom.progress",
    archive: "bloom.archive",
    library: "bloom.library",
    favorites: "bloom.favorites"
  };
  function load(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

  // ---- settings -----------------------------------------------------------
  const defaultSettings = {
    dark: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches,
    reduceMotion: window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    contrast: window.matchMedia && window.matchMedia("(prefers-contrast: more)").matches,
    largeText: false,
    calmPalette: true,
    sound: true,
    haptics: true
  };
  let settings = Object.assign({}, defaultSettings, load(KEY.settings, {}));
  const DEPTHS = [
    { id: "gentle", label: "Gentle" },
    { id: "standard", label: "Standard" },
    { id: "deep", label: "Deep" }
  ];
  let depth = DEPTHS.some((item) => item.id === load(KEY.depth, "standard")) ? load(KEY.depth, "standard") : "standard";

  function applySettings() {
    const r = document.documentElement;
    r.classList.toggle("dark", !!settings.dark);
    r.classList.toggle("reduce-motion", !!settings.reduceMotion);
    r.classList.toggle("contrast", !!settings.contrast);
    r.classList.toggle("large-text", !!settings.largeText);
    r.classList.toggle("calm-palette", !!settings.calmPalette);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", settings.dark ? "#221f25" : "#fbf7f0");
  }

  // ---- date + deterministic pack -----------------------------------------
  function dateKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  function prettyDate(key) {
    const [y, m, day] = key.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }
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
  function dayNum(key) { const p = key.split("-").map(Number); return Math.floor(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000); }
  function seasonForKey(key) {
    const month = Number(key.split("-")[1]);
    if (month === 12 || month <= 2) return { id: "winter", name: "Winter light", wordTheme: "weather", note: "cool skies and quiet weather words" };
    if (month <= 5) return { id: "spring", name: "Spring garden", wordTheme: "garden", note: "fresh greens and garden words" };
    if (month <= 8) return { id: "summer", name: "Summer meadow", wordTheme: "nature", note: "sunlit colours and nature words" };
    return { id: "autumn", name: "Autumn table", wordTheme: "kitchen", note: "warm earth colours and cosy kitchen words" };
  }
  // Seed namespace from /runtime-config.js: "" in the private app, "demo-" in the public demo,
  // so the two never generate the same daily set. Read defensively — if runtime-config.js failed
  // to load, falling back to "" means the private behaviour, never a half-salted state.
  const SEED_NS = typeof window.BLOOM_SEED_NAMESPACE === "string" ? window.BLOOM_SEED_NAMESPACE : "";

  function buildPack(key) {
    const rng = mulberry32(hashStr("bloom-" + SEED_NS + key));
    const artwork = window.BloomArt.forDayKey(key); // fresh procedural art each day
    const season = seasonForKey(key);
    const dn = dayNum(key);
    // Rotating variety keeps days fresh while the logic anchor stays stable:
    //   warm-up  : pattern → word → odd-one-out → word search (cycles by day)
    //   finish   : art assembly ↔ complete-the-symmetry (alternates by day)
    // → 4 × 2 = 8 distinct daily sets. The day's artwork still reveals on completion.
    const warmFns = [
      () => window.BloomPuzzles.makePattern(rng, { difficulty: depth }),
      () => window.BloomPuzzles.makeWord(rng, { difficulty: depth, wordTheme: season.wordTheme }),
      () => window.BloomPuzzles.makeOddOneOut(rng, { difficulty: depth }),
      () => window.BloomPuzzles.makeWordSearch(rng, { artwork, theme: artwork.theme, wordTheme: season.wordTheme, difficulty: depth })
    ];
    const warm = warmFns[dn % warmFns.length]();
    const finish = (dn % 2 === 0)
      ? window.BloomPuzzles.makeAssembly(rng, artwork)
      : window.BloomPuzzles.makeSymmetry(rng);
    const puzzles = [warm, window.BloomPuzzles.makeLogic(rng, { difficulty: depth }), finish];
    return { artwork, puzzles };
  }

  // ---- progress + archive -------------------------------------------------
  function getSolved(key) { return load(KEY.progress, {})[key] || 0; }
  function setSolved(key, n) {
    const p = load(KEY.progress, {});
    p[key] = Math.max(p[key] || 0, n);
    save(KEY.progress, p);
    pushServerState();
  }
  function archiveDay(key, artwork) {
    const a = load(KEY.archive, {});
    if (!a[key]) { a[key] = { date: key, artId: artwork.id, title: artwork.title, theme: artwork.theme }; save(KEY.archive, a); }
    pushServerState();
  }
  function getLibraryState() {
    const value = load(KEY.library, {});
    return {
      counters: value.counters && typeof value.counters === "object" ? value.counters : {},
      effort: value.effort && typeof value.effort === "object" ? value.effort : {}
    };
  }
  function libraryIndex(family) {
    return Math.max(0, Math.floor(Number(getLibraryState().counters[family]) || 0));
  }
  function advanceLibrary(family) {
    const library = getLibraryState();
    library.counters[family] = libraryIndex(family) + 1;
    const group = ["wordsearch", "word", "anagram", "wordchain", "crossword"].includes(family) ? "wordGardener"
      : ["pattern", "symmetry", "nonogram", "shapefit"].includes(family) ? "patternFinisher"
        : ["logic", "sudoku", "flow"].includes(family) ? "logicTender"
          : "quietCollector";
    library.effort.explorer = Math.max(0, Number(library.effort.explorer) || 0) + 1;
    library.effort[group] = Math.max(0, Number(library.effort[group]) || 0) + 1;
    save(KEY.library, library);
    pushServerState();
  }

  // ---- favourites + saving artwork ----------------------------------------
  function getFavorites() { const v = load(KEY.favorites, {}); return v && typeof v === "object" ? v : {}; }
  function isFavorite(key) { return !!getFavorites()[key]; }
  function toggleFavorite(key) {
    const f = getFavorites();
    if (f[key]) delete f[key]; else f[key] = 1;
    save(KEY.favorites, f);
    pushServerState();
    return !!f[key];
  }
  // Rasterise an artwork's SVG to a high-resolution PNG the player can keep or set as a
  // wallpaper. On phones this opens the share sheet (→ Save to Photos); elsewhere
  // it downloads. Everything is local — no upload, fully offline.
  function saveArtwork(artwork, onDone) {
    const SS = 1536, W = 1290, H = 2796; // square render → portrait wallpaper
    const sized = artwork.svg.replace("<svg ", `<svg width="${SS}" height="${SS}" `);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const c = canvas.getContext("2d");
        c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
        const scale = Math.max(W / SS, H / SS), w = SS * scale, h = SS * scale;
        c.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        canvas.toBlob((blob) => {
          if (!blob) { if (onDone) onDone(false); return; }
          const fname = "bloom-" + String(artwork.title || "art").replace(/[^a-z0-9]+/gi, "-").toLowerCase() + ".png";
          const file = new File([blob], fname, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: artwork.title || "Bloom artwork" }).then(() => onDone && onDone(true)).catch(() => onDone && onDone(false));
          } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1500);
            if (onDone) onDone(true);
          }
        }, "image/png");
      } catch (e) { if (onDone) onDone(false); }
    };
    img.onerror = () => { if (onDone) onDone(false); };
    img.src = window.BloomArt.dataUri(sized);
  }

  // ---- per-account sync: each signed-in user has their OWN gallery/progress,
  // stored on the server and loaded on any device they sign in from. ----------
  async function loadServerState() {
    if (!currentUser) return;
    try {
      const r = await fetch("/user/state", { credentials: "same-origin" });
      const d = await r.json();
      if (d && d.ok) {
        // The account is the source of truth: apply its saved data, or start
        // fresh for a brand-new account (so accounts never see each other's data).
        save(KEY.progress, (d.state && d.state.progress) || {});
        save(KEY.archive, (d.state && d.state.archive) || {});
        save(KEY.library, (d.state && d.state.library) || {});
        save(KEY.favorites, (d.state && d.state.favorites) || {});
        depth = d.state && DEPTHS.some((item) => item.id === d.state.depth) ? d.state.depth : "standard";
        save(KEY.depth, depth);
        settings = Object.assign({}, settings, (d.state && d.state.sensory) || {});
        save(KEY.settings, settings);
        applySettings();
      }
    } catch {}
  }
  function pushServerState() {
    if (!currentUser) return;
    fetch("/user/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        progress: load(KEY.progress, {}),
        archive: load(KEY.archive, {}),
        library: getLibraryState(),
        favorites: getFavorites(),
        depth,
        sensory: {
          calmPalette: !!settings.calmPalette,
          sound: !!settings.sound,
          haptics: !!settings.haptics,
          dark: !!settings.dark,
          reduceMotion: !!settings.reduceMotion,
          contrast: !!settings.contrast,
          largeText: !!settings.largeText
        }
      })
    }).catch(() => {});
  }

  // ---- gentle, NON-LOSSY milestones. The player can only ever gain. -------------
  const BADGES = [
    { days: 1, name: "First Day", icon: "🌱" },
    { days: 3, name: "Sprouting", icon: "🌿" },
    { days: 7, name: "First Bloom", icon: "🌷" },
    { days: 14, name: "Bouquet", icon: "💐" },
    { days: 30, name: "Full Garden", icon: "🌻" },
    { days: 60, name: "Grove", icon: "🌳" },
    { days: 100, name: "Blossoming", icon: "🏵️" },
    { days: 200, name: "Botanist", icon: "🪴" },
    { days: 365, name: "A Year in Bloom", icon: "🌸" }
  ];
  const EFFORT_BADGES = [
    { key: "explorer", name: "Explorer", icon: "🧭", note: "Tried the Library" },
    { key: "wordGardener", name: "Word-gardener", icon: "🌱", note: "Tended word puzzles" },
    { key: "patternFinisher", name: "Pattern-finisher", icon: "🧩", note: "Completed patterns" },
    { key: "quietCollector", name: "Quiet-collector", icon: "🪺", note: "Gathered artful pairs" },
    { key: "logicTender", name: "Logic-tender", icon: "🪴", note: "Worked through logic" }
  ];
  function totalDays() { return Object.keys(load(KEY.archive, {})).length; }
  function nextBadge(n) { return BADGES.find((b) => n < b.days) || null; }

  // ---- view state ---------------------------------------------------------
  let currentTab = "today";
  let playing = false;   // inside the daily puzzle flow
  let replay = false;    // replaying a finished day "just for fun"
  let playIndex = 0;
  let libraryFamily = null;
  let libraryPlaying = false;
  let currentUser = null;  // { email, name, isAdmin } when signed in
  let enforced = false;    // true once invite-only sign-in is configured

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function howCard(puzzle) {
    const card = el("section", "how-card");
    card.setAttribute("aria-label", "How this works");
    card.appendChild(el("h3", null, "How this works"));
    const list = el("ul", "how-steps");
    const steps = String(puzzle.rules || "").match(/[^.!?]+[.!?]?/g) || [];
    steps.map((step) => step.trim()).filter(Boolean).forEach((step) => list.appendChild(el("li", null, step)));
    card.appendChild(list);
    const example = el("div", "how-example");
    example.appendChild(el("strong", null, "Example"));
    example.appendChild(el("span", null, (puzzle.hints && puzzle.hints[0]) || "Choose one clear step, then see what changes."));
    card.appendChild(example);
    return card;
  }
  function gentleFeedback() {
    if (settings.haptics && navigator.vibrate) navigator.vibrate(12);
    if (!settings.sound) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      const context = new AudioContext();
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.frequency.value = 440;
      volume.gain.setValueAtTime(0.025, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.12);
      tone.connect(volume); volume.connect(context.destination);
      tone.start(); tone.stop(context.currentTime + 0.12);
    } catch {}
  }
  function setActiveTab(name) {
    tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.tab === name));
  }

  function setDepth(next) {
    if (!DEPTHS.some((item) => item.id === next)) return;
    depth = next;
    save(KEY.depth, depth);
    pushServerState();
  }
  function depthPicker(onChange) {
    const wrap = el("div", "depth-picker");
    wrap.setAttribute("aria-label", "Puzzle depth");
    DEPTHS.forEach((item) => {
      const button = el("button", "depth-choice", item.label);
      button.type = "button";
      button.classList.toggle("is-active", item.id === depth);
      button.setAttribute("aria-pressed", item.id === depth ? "true" : "false");
      button.addEventListener("click", () => {
        if (item.id === depth) return;
        setDepth(item.id);
        if (onChange) onChange();
      });
      wrap.appendChild(button);
    });
    return wrap;
  }

  const LIBRARY_FAMILIES = [
    { id: "wordsearch", title: "Word search", description: "Find a small collection of art-themed words.", make: (rng, opts) => window.BloomPuzzles.makeWordSearch(rng, opts) },
    { id: "matching", title: "Art tile matching", description: "Pair visible art tiles at your own pace.", make: (rng, opts) => window.BloomPuzzles.makeMatching(rng, opts) },
    { id: "anagram", title: "Letter-bank anagrams", description: "Gather themed letters into one clear answer.", make: (rng, opts) => window.BloomPuzzles.makeAnagram(rng, opts) },
    { id: "wordchain", title: "Word ladders", description: "Change one letter at a time along a clue-led path.", make: (rng, opts) => window.BloomPuzzles.makeWordChain(rng, opts) },
    { id: "crossword", title: "Crossword-lite", description: "Fit two clue-led words around a shared letter.", make: (rng, opts) => window.BloomPuzzles.makeCrosswordLite(rng, opts) },
    { id: "sudoku", title: "Mini-sudoku", description: "A small, uniquely solvable number grid with gentle tools.", make: (rng, opts) => window.BloomPuzzles.makeSudoku(rng, opts) },
    { id: "spot", title: "Spot the difference", description: "Notice a few clear changes in Bloom artwork.", make: (rng, opts) => window.BloomPuzzles.makeSpotDifference(rng, opts) },
    { id: "memory", title: "Art memory pairs", description: "Turn over small semantic pairs with an optional preview.", make: (rng, opts) => window.BloomPuzzles.makeMemory(rng, opts) },
    { id: "nonogram", title: "Tiny Picross", description: "Use row and column clues to uncover a 5×5 picture.", make: (rng, opts) => window.BloomPuzzles.makeNonogram(rng, opts) },
    { id: "shapefit", title: "Gentle shape-fit", description: "Set colourful pieces into generous silhouettes.", make: (rng, opts) => window.BloomPuzzles.makeShapeFit(rng, opts) },
    { id: "flow", title: "Quiet connections", description: "Trace small coloured routes between matching ends.", make: (rng, opts) => window.BloomPuzzles.makeFlow(rng, opts) },
    { id: "word", title: "Word play", description: "Unscramble a gentle word from its letters.", make: (rng, opts) => window.BloomPuzzles.makeWord(rng, opts) },
    { id: "pattern", title: "Patterns", description: "Notice the change and choose what comes next.", make: (rng) => window.BloomPuzzles.makePattern(rng) },
    { id: "logic", title: "Garden logic", description: "Use the clues to match flowers and pots.", make: (rng) => window.BloomPuzzles.makeLogic(rng) },
    { id: "assembly", title: "Picture pieces", description: "Swap tiles until a calm picture is whole.", make: (rng, opts) => window.BloomPuzzles.makeAssembly(rng, opts.artwork) },
    { id: "odd", title: "Odd one out", description: "Find the one tile that is quietly different.", make: (rng) => window.BloomPuzzles.makeOddOneOut(rng) },
    { id: "symmetry", title: "Mirror patterns", description: "Complete the other half of a pattern.", make: (rng) => window.BloomPuzzles.makeSymmetry(rng) }
  ];

  function libraryFamilyById(id) {
    return LIBRARY_FAMILIES.find((family) => family.id === id) || LIBRARY_FAMILIES[0];
  }
  function buildLibraryPuzzle(family, index) {
    const seedText = "bloom-lib-" + family.id + "-" + index;
    const rng = mulberry32(hashStr(seedText));
    const dayArtwork = window.BloomArt.forDayKey(dateKey());
    // Picture assembly uses a separate library artwork: daily art is still only
    // revealed by finishing Today. Word Search receives today's art as theme data.
    const artIndex = hashStr(seedText + "-art") % window.BloomArt.ART.length;
    const artwork = family.id === "wordsearch" ? dayArtwork : window.BloomArt.byIndex(artIndex);
    const season = seasonForKey(dateKey());
    return family.make(rng, { artwork, theme: dayArtwork.theme, wordTheme: season.wordTheme, season: season.id, difficulty: depth });
  }
  function openLibrary(familyId) {
    libraryFamily = libraryFamilyById(familyId).id;
    libraryPlaying = true;
    currentTab = "more";
    playing = false;
    replay = false;
    setActiveTab("more");
    render();
  }

  // ---- Today --------------------------------------------------------------
  function renderToday() {
    screen.innerHTML = "";
    const key = dateKey();
    const pack = buildPack(key);
    const solved = getSolved(key);
    const total = pack.puzzles.length;

    if (playing) { renderPuzzle(key, pack); return; }

    if (solved >= total && !replay) {
      // Completed — a calm, finished moment. No pressure to do more.
      const wrap = el("div", "celebrate");
      wrap.appendChild(el("h2", null, "Today's page is complete 🌸"));
      const art = el("div", "reveal-art");
      art.style.backgroundImage = `url("${window.BloomArt.dataUri(pack.artwork.svg)}")`;
      wrap.appendChild(art);
      wrap.appendChild(el("p", "muted", `You revealed <strong>${pack.artwork.title}</strong> for your gallery.`));
      const saveRow = el("div", "reveal-actions");
      const saveBtn = el("button", "btn secondary", "Save image");
      saveBtn.addEventListener("click", () => {
        saveBtn.disabled = true; saveBtn.textContent = "Saving…";
        saveArtwork(pack.artwork, () => { saveBtn.disabled = false; saveBtn.textContent = "Save image"; });
      });
      saveRow.appendChild(saveBtn);
      wrap.appendChild(saveRow);
      const jb = BADGES.find((b) => b.days === totalDays());
      if (jb) wrap.appendChild(el("p", "badge-earned", `${jb.icon} New badge: “${jb.name}” — ${jb.days} days!`));
      const continuation = el("div", "continuation");
      continuation.appendChild(el("h3", null, "Would you like to stay a little longer?"));
      continuation.appendChild(el("p", "muted", "Any of these is a good choice."));
      const choices = el("div", "continuation-options");
      const lastFamily = pack.puzzles[pack.puzzles.length - 1].type;
      const more = el("button", "btn continuation-choice", "More like this");
      more.addEventListener("click", () => openLibrary(lastFamily));
      const alternatives = LIBRARY_FAMILIES.filter((family) => family.id !== lastFamily);
      const differentRng = mulberry32(hashStr("bloom-different-" + SEED_NS + key));
      const differentFamily = alternatives[Math.floor(differentRng() * alternatives.length)];
      const different = el("button", "btn continuation-choice", "Something different");
      different.addEventListener("click", () => openLibrary(differentFamily.id));
      const finish = el("button", "btn continuation-choice", "Finish here");
      finish.addEventListener("click", () => {
        continuation.innerHTML = "";
        continuation.appendChild(el("p", "finish-note", "All finished for today. This is a lovely place to pause."));
        continuation.tabIndex = -1;
        continuation.focus();
      });
      choices.appendChild(more);
      choices.appendChild(different);
      choices.appendChild(finish);
      continuation.appendChild(choices);
      wrap.appendChild(continuation);

      const gentleLinks = el("div", "completion-links");
      const galleryLink = el("button", "calm-link", "See today's artwork in your gallery");
      galleryLink.type = "button";
      galleryLink.addEventListener("click", () => switchTab("gallery"));
      const replayLink = el("button", "calm-link", "Play again, just for fun");
      replayLink.type = "button";
      replayLink.addEventListener("click", () => {
        replay = true;
        playing = true;
        playIndex = 0;
        renderToday();
      });
      gentleLinks.appendChild(galleryLink);
      gentleLinks.appendChild(replayLink);
      wrap.appendChild(gentleLinks);
      screen.appendChild(wrap);
      return;
    }

    // Intro / start screen — one clear thing to do.
    const hero = el("div", "hero");
    hero.appendChild(el("h1", null, "Today's page"));
    hero.appendChild(el("p", "hero-est", `A calm ${total}-puzzle set · about 7 minutes`));
    const art = el("div", "hero-art");
    art.style.backgroundImage = `url("${window.BloomArt.dataUri(pack.artwork.svg)}")`;
    art.style.filter = "blur(7px)";
    art.title = "Finish today to reveal the artwork";
    hero.appendChild(art);
    hero.appendChild(el("p", "muted", solved > 0 ? "Welcome back — pick up where you left off." : "Finish the set to reveal today's artwork."));
    const play = el("button", "btn", solved > 0 ? "Continue" : "Play today");
    play.addEventListener("click", () => { playing = true; replay = false; playIndex = getSolved(key); renderToday(); });
    hero.appendChild(play);

    // Demo only. The daily page is deliberately three puzzles from a small rotation, which is
    // right for a daily ritual but means someone trying the demo once sees a fraction of what
    // the app does. The "More" tab already holds every kind; nobody has a reason to guess that,
    // so say it. The private app gets no such nudge.
    if (window.BLOOM_DEMO) {
      const breadth = el("p", "muted");
      breadth.appendChild(document.createTextNode(`There are ${LIBRARY_FAMILIES.length} kinds of puzzle in here, all generated in your browser. `));
      const browse = el("button", "calm-link", "Browse them all");
      browse.type = "button";
      browse.addEventListener("click", () => switchTab("more"));
      breadth.appendChild(browse);
      hero.appendChild(breadth);
    }

    screen.appendChild(hero);
  }

  function packDots(total, current) {
    const row = el("div", "pack-dots");
    for (let i = 0; i < total; i += 1) {
      const d = el("span", "pack-dot");
      if (i < current) d.classList.add("done");
      else if (i === current) d.classList.add("current");
      row.appendChild(d);
    }
    return row;
  }

  function renderPuzzle(key, pack) {
    const total = pack.puzzles.length;
    if (playIndex >= total) { finishDay(key, pack); return; }
    const puzzle = pack.puzzles[playIndex];

    screen.innerHTML = "";
    const wrap = el("div", "pzwrap");
    wrap.appendChild(packDots(total, playIndex));

    const head = el("div", "pzhead");
    head.appendChild(el("div", "step", `Puzzle ${playIndex + 1} of ${total}`));
    head.appendChild(el("h2", null, puzzle.title));
    wrap.appendChild(head);
    wrap.appendChild(depthPicker(() => renderToday()));

    wrap.appendChild(howCard(puzzle));

    const body = el("div", "pzbody");
    const playArea = el("div");
    body.appendChild(playArea);

    const hintBox = el("div", "hintbox");
    hintBox.hidden = true;
    body.appendChild(hintBox);
    wrap.appendChild(body);

    // Actions: hint (no penalty) + a continue button that appears once solved.
    const actions = el("div", "pzactions");
    let hintStep = 0;
    const hintBtn = el("button", "btn secondary", "Hint");
    hintBtn.addEventListener("click", () => {
      if (hintStep < puzzle.hints.length) {
        hintBox.hidden = false;
        hintBox.textContent = puzzle.hints[hintStep];
        hintStep += 1;
        if (playArea._applyHint) playArea._applyHint(hintStep); // some puzzles also nudge the board
        if (hintStep >= puzzle.hints.length) hintBtn.disabled = true;
      }
    });
    actions.appendChild(hintBtn);

    const nextBtn = el("button", "btn", playIndex + 1 >= total ? "Finish" : "Continue");
    nextBtn.style.display = "none";
    nextBtn.addEventListener("click", () => {
      playIndex += 1;
      if (!replay) setSolved(key, playIndex);
      renderPuzzle(key, pack);
    });
    actions.appendChild(nextBtn);
    wrap.appendChild(actions);

    screen.appendChild(wrap);
    screen.focus();

    puzzle.render(playArea, {
      onSolved() {
        gentleFeedback();
        nextBtn.style.display = "";
        hintBtn.disabled = true;
        if (!replay) setSolved(key, playIndex + 1);
      }
    });
  }

  function finishDay(key, pack) {
    if (!replay) archiveDay(key, pack.artwork);
    playing = false;
    replay = false;
    renderToday();
  }

  // ---- More / Library -----------------------------------------------------
  function renderMore() {
    screen.innerHTML = "";
    if (libraryPlaying && libraryFamily) {
      renderLibraryPuzzle(libraryFamilyById(libraryFamily));
      return;
    }

    screen.appendChild(el("h1", null, "More puzzles"));
    screen.appendChild(el("p", "muted library-intro", "Choose any kind whenever you feel like playing. Stop whenever you like."));
    const season = seasonForKey(dateKey());
    const seasonCard = el("div", `season-card season-${season.id}`);
    seasonCard.appendChild(el("strong", null, season.name));
    seasonCard.appendChild(el("span", null, season.note + ". It is simply here to enjoy; nothing expires."));
    screen.appendChild(seasonCard);
    const list = el("div", "library-list");
    LIBRARY_FAMILIES.forEach((family) => {
      const choice = el("button", "library-choice");
      choice.type = "button";
      const copy = el("span", "library-copy");
      copy.appendChild(el("span", "library-title", family.title));
      copy.appendChild(el("span", "library-description", family.description));
      choice.appendChild(copy);
      choice.appendChild(el("span", "library-arrow", "›"));
      choice.addEventListener("click", () => openLibrary(family.id));
      list.appendChild(choice);
    });
    screen.appendChild(list);
  }

  function renderLibraryPuzzle(family) {
    const index = libraryIndex(family.id);
    const puzzle = buildLibraryPuzzle(family, index);
    const wrap = el("div", "pzwrap library-puzzle");
    const back = el("button", "library-back", "‹ Back to More");
    back.type = "button";
    back.addEventListener("click", () => { libraryPlaying = false; renderMore(); });
    wrap.appendChild(back);

    const head = el("div", "pzhead");
    head.appendChild(el("div", "step", family.title));
    head.appendChild(el("h2", null, puzzle.title));
    wrap.appendChild(head);
    wrap.appendChild(depthPicker(() => renderMore()));
    wrap.appendChild(howCard(puzzle));

    const body = el("div", "pzbody");
    const playArea = el("div");
    const hintBox = el("div", "hintbox");
    hintBox.hidden = true;
    body.appendChild(playArea);
    body.appendChild(hintBox);
    wrap.appendChild(body);

    const actions = el("div", "pzactions");
    let hintStep = 0;
    let recorded = false;
    const hintBtn = el("button", "btn secondary", "Hint");
    hintBtn.addEventListener("click", () => {
      if (hintStep >= puzzle.hints.length) return;
      hintBox.hidden = false;
      hintBox.textContent = puzzle.hints[hintStep];
      hintStep += 1;
      if (playArea._applyHint) playArea._applyHint(hintStep);
      if (hintStep >= puzzle.hints.length) hintBtn.disabled = true;
    });
    const nextBtn = el("button", "btn", "Another puzzle");
    nextBtn.style.display = "none";
    nextBtn.addEventListener("click", () => renderMore());
    actions.appendChild(hintBtn);
    actions.appendChild(nextBtn);
    wrap.appendChild(actions);
    screen.appendChild(wrap);
    screen.focus();

    puzzle.render(playArea, {
      onSolved() {
        gentleFeedback();
        if (!recorded) {
          recorded = true;
          advanceLibrary(family.id);
        }
        hintBtn.disabled = true;
        nextBtn.style.display = "";
      }
    });
  }

  // ---- Gallery ------------------------------------------------------------
  function gardenCard() {
    const n = totalDays();
    const garden = el("div", "card garden");
    garden.appendChild(el("div", "garden-count", `<strong>${n}</strong> day${n === 1 ? "" : "s"} bloomed 🌸`));
    const row = el("div", "badge-row");
    BADGES.forEach((b) => {
      const got = n >= b.days;
      const chip = el("div", `badge ${got ? "got" : "locked"}`);
      chip.innerHTML = `<span class="bico">${got ? b.icon : "🔒"}</span><span class="bname">${b.name}</span><span class="bd">${b.days}d</span>`;
      row.appendChild(chip);
    });
    garden.appendChild(row);
    const nb = nextBadge(n);
    if (nb) garden.appendChild(el("div", "garden-next muted", `${nb.days - n} more day${nb.days - n === 1 ? "" : "s"} to “${nb.name}” ${nb.icon}`));
    return garden;
  }
  function effortCard() {
    const effort = getLibraryState().effort;
    const earned = EFFORT_BADGES.filter((badge) => Number(effort[badge.key]) > 0);
    const card = el("div", "card effort-card");
    card.appendChild(el("h2", null, "Library keepsakes"));
    if (!earned.length) {
      card.appendChild(el("p", "muted", "Exploring the Library will leave gentle records here. They never expire."));
      return card;
    }
    const row = el("div", "effort-badges");
    earned.forEach((badge) => {
      const chip = el("div", "effort-badge");
      chip.innerHTML = `<span class="effort-icon">${badge.icon}</span><strong>${badge.name}</strong><span>${badge.note}</span>`;
      row.appendChild(chip);
    });
    card.appendChild(row);
    card.appendChild(el("p", "muted effort-note", "These only record things you explored. Taking time away never changes them."));
    return card;
  }
  function monthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  function galleryCard(key, archive) {
    const entry = archive[key] || {};
    const art = window.BloomArt.forDayKey(key);
    const card = el("div", "gcard");
    const im = el("div", "art");
    im.style.backgroundImage = `url("${window.BloomArt.dataUri(art.svg)}")`;
    card.appendChild(im);
    const cap = el("div", "cap");
    cap.appendChild(el("div", null, entry.title || art.title));
    cap.appendChild(el("div", "d", prettyDate(key)));
    const actions = el("div", "gactions");
    const fav = el("button", "gicon" + (isFavorite(key) ? " is-fav" : ""));
    fav.type = "button";
    fav.setAttribute("aria-label", isFavorite(key) ? "Remove from favourites" : "Add to favourites");
    fav.textContent = isFavorite(key) ? "♥" : "♡";
    fav.addEventListener("click", () => { toggleFavorite(key); renderGallery(); });
    const save = el("button", "gicon");
    save.type = "button";
    save.setAttribute("aria-label", "Save this artwork");
    save.textContent = "⤓";
    save.addEventListener("click", () => {
      save.disabled = true; save.textContent = "…";
      saveArtwork(art, () => { save.disabled = false; save.textContent = "⤓"; });
    });
    actions.appendChild(fav); actions.appendChild(save);
    cap.appendChild(actions);
    card.appendChild(cap);
    return card;
  }
  function renderGallery() {
    screen.innerHTML = "";
    screen.appendChild(el("h1", null, "Your garden"));
    const archive = load(KEY.archive, {});
    const keys = Object.keys(archive).sort().reverse(); // auto-sorted, newest first
    screen.appendChild(effortCard());
    if (!keys.length) {
      screen.appendChild(el("p", "muted", "Finish a day to grow your garden — each one adds an artwork. Missing days is completely fine."));
      screen.appendChild(el("div", "empty", "No pieces yet — finish today's page to reveal your first artwork. 🌱"));
      return;
    }
    screen.appendChild(gardenCard());

    // Favourites surface automatically at the top.
    const favs = keys.filter(isFavorite);
    if (favs.length) {
      const folio = el("section", "folio");
      folio.appendChild(el("h3", null, "♥ Favourites"));
      const grid = el("div", "gallery-grid");
      favs.forEach((key) => grid.appendChild(galleryCard(key, archive)));
      folio.appendChild(grid);
      screen.appendChild(folio);
    }

    // Everything, auto-grouped into monthly folios (newest month first).
    screen.appendChild(el("h2", "folio-heading", "Your folios"));
    const months = {};
    keys.forEach((key) => { const m = key.slice(0, 7); (months[m] = months[m] || []).push(key); });
    Object.keys(months).sort().reverse().forEach((month) => {
      const folio = el("section", "folio");
      folio.appendChild(el("h3", null, monthLabel(month)));
      const grid = el("div", "gallery-grid");
      months[month].forEach((key) => grid.appendChild(galleryCard(key, archive)));
      folio.appendChild(grid);
      screen.appendChild(folio);
    });
  }

  // ---- Settings -----------------------------------------------------------
  function toggleRow(label, sub, value, onChange) {
    const row = el("div", "setrow");
    const left = el("div");
    left.appendChild(el("div", "label", label));
    if (sub) left.appendChild(el("div", "sub", sub));
    row.appendChild(left);
    const sw = el("label", "switch");
    const input = el("input");
    input.type = "checkbox";
    input.checked = !!value;
    input.setAttribute("aria-label", label);
    input.addEventListener("change", () => onChange(input.checked));
    sw.appendChild(input);
    sw.appendChild(el("span", "track"));
    sw.appendChild(el("span", "thumb"));
    row.appendChild(sw);
    return row;
  }
  function renderSettings() {
    screen.innerHTML = "";
    screen.appendChild(el("h1", null, "Settings"));
    const card = el("div", "card");
    const set = (k, v) => { settings[k] = v; save(KEY.settings, settings); applySettings(); pushServerState(); };
    card.appendChild(toggleRow("Calm colour palette", "Uses Bloom's quietest colour balance.", settings.calmPalette, (v) => set("calmPalette", v)));
    card.appendChild(toggleRow("Calm mode (reduced motion)", "Less animation and movement.", settings.reduceMotion, (v) => set("reduceMotion", v)));
    card.appendChild(toggleRow("Dark theme", "Softer in low light.", settings.dark, (v) => set("dark", v)));
    card.appendChild(toggleRow("Higher contrast", "Stronger outlines and text.", settings.contrast, (v) => set("contrast", v)));
    card.appendChild(toggleRow("Larger text", "Bigger, easier to read.", settings.largeText, (v) => set("largeText", v)));
    card.appendChild(toggleRow("Soft completion sound", "A quiet chime when you finish. On by default — turn off any time.", settings.sound, (v) => set("sound", v)));
    card.appendChild(toggleRow("Gentle haptic tap", "A soft tap when you finish (on supported phones). On by default.", settings.haptics, (v) => set("haptics", v)));
    screen.appendChild(card);

    const depthCard = el("div", "card depth-settings");
    depthCard.appendChild(el("h2", null, "Puzzle depth"));
    depthCard.appendChild(el("p", "sub muted", "Choose the kind of puzzle that feels right. You can change this during play too."));
    depthCard.appendChild(depthPicker(() => renderSettings()));
    screen.appendChild(depthCard);

    if (currentUser) {
      const acct = el("div", "card");
      acct.appendChild(el("div", "label", `Signed in as ${currentUser.name}`));
      acct.appendChild(el("div", "sub muted", currentUser.email));
      const out = el("button", "btn secondary", "Sign out");
      out.style.marginTop = "12px";
      out.addEventListener("click", () => window.BloomAuth.logout());
      acct.appendChild(out);
      screen.appendChild(acct);
      if (currentUser.isAdmin) renderInvites(screen);
    }

    screen.appendChild(el("p", "note",
      "Bloom is a gentle daily ritual, not a medical tool. Play when you like and skip when you like. Your puzzles and gallery stay on this device."));
  }

  // ---- invite-only gate ---------------------------------------------------
  function renderGate() {
    screen.innerHTML = "";
    const card = el("div", "card center");
    card.appendChild(el("h1", null, "Bloom 🌸"));
    card.appendChild(el("p", "muted", "Bloom is invite-only. Please sign in with the Google account you were invited with."));
    const slot = el("div"); slot.style.margin = "16px 0 6px";
    card.appendChild(slot);
    const msg = el("p", "muted"); card.appendChild(msg);
    screen.appendChild(card);
    window.BloomAuth.renderSignIn(slot, {
      onSuccess() { location.reload(); },
      onError(t) { msg.textContent = t; }
    });
  }

  // ---- admin: invites (shown in Settings for admins) ----------------------
  async function renderInvites(parent) {
    const card = el("div", "card");
    card.appendChild(el("h2", null, "Invites"));
    card.appendChild(el("p", "sub muted", "People you add here can sign in with that Google email."));
    const list = el("div"); list.style.margin = "10px 0";
    card.appendChild(list);
    const addRow = el("div"); addRow.style.display = "flex"; addRow.style.gap = "8px";
    const input = el("input"); input.type = "email"; input.placeholder = "name@gmail.com";
    input.style.flex = "1"; input.style.minHeight = "44px"; input.style.borderRadius = "12px";
    input.style.border = "1px solid var(--line)"; input.style.padding = "0 12px"; input.style.background = "var(--surface)"; input.style.color = "var(--ink)";
    const addBtn = el("button", "btn", "Add"); addBtn.style.width = "auto"; addBtn.style.padding = "0 18px";
    addRow.appendChild(input); addRow.appendChild(addBtn);
    card.appendChild(addRow);
    const note = el("p", "sub muted"); note.style.marginTop = "8px"; card.appendChild(note);
    parent.appendChild(card);

    function paint(invites, admins) {
      list.innerHTML = "";
      (admins || []).forEach((e) => {
        const row = el("div", "setrow");
        row.appendChild(el("div", null, `${e} <span class="sub muted">(admin)</span>`));
        list.appendChild(row);
      });
      if (!invites.length) list.appendChild(el("div", "sub muted", "No invites yet."));
      invites.forEach((e) => {
        const row = el("div", "setrow");
        row.appendChild(el("div", null, e));
        const rm = el("button", "btn secondary", "Remove"); rm.style.width = "auto"; rm.style.minHeight = "44px"; rm.style.padding = "0 14px";
        rm.addEventListener("click", async () => { const d = await window.BloomAuth.removeInvite(e); paint(d.invites || [], admins); });
        row.appendChild(rm);
        list.appendChild(row);
      });
    }
    let admins = [];
    try { const d = await window.BloomAuth.listInvites(); admins = d.admins || []; paint(d.invites || [], admins); } catch { note.textContent = "Couldn't load invites."; }

    addBtn.addEventListener("click", async () => {
      const email = (input.value || "").trim().toLowerCase();
      if (!email) return;
      const r = await window.BloomAuth.addInvite(email);
      if (r.ok) { input.value = ""; note.textContent = `Invited ${email}.`; paint(r.data.invites || [], admins); }
      else { note.textContent = (r.data && r.data.error) || "Couldn't add that email."; }
    });
  }

  // ---- nav ----------------------------------------------------------------
  function switchTab(name) {
    currentTab = name;
    if (name !== "today") { playing = false; replay = false; }
    if (name !== "more") libraryPlaying = false;
    setActiveTab(name);
    render();
  }
  function render() {
    if (currentTab === "today") renderToday();
    else if (currentTab === "more") renderMore();
    else if (currentTab === "gallery") renderGallery();
    else renderSettings();
  }

  tabs.forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  // ---- boot ---------------------------------------------------------------
  (async function boot() {
    applySettings();
    topDate.textContent = prettyDate(dateKey());

    try {
      const auth = await window.BloomAuth.getMe();
      currentUser = auth.user || null;
      enforced = auth.enforced;
    } catch { currentUser = null; enforced = false; }

    // Invite-only: if sign-in is configured and nobody is signed in, gate the app.
    if (enforced && !currentUser) {
      document.body.classList.add("gated");
      renderGate();
    } else {
      document.body.classList.remove("gated");
      if (currentUser) await loadServerState(); // load this account's gallery/progress first
      setActiveTab("today");
      render();
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  })();
})();
