"use strict";

// Bloom puzzle families. Each family exposes make(rng) -> a puzzle instance:
//   { type, title, rules, hints:[..], render(root, { onSolved }) }
// Everything is deterministic from the passed-in seeded rng, self-validating
// (no ambiguity / "gotchas"), forgiving (wrong answers never punish), and keeps
// the rules visible and the pace forgiving.
(function () {
  const PALETTE = ["#e58fa6", "#7faa72", "#6fa8c7", "#f4c95d", "#b58fd6", "#e8956b"];

  // Calm themed words with plain clues, shared by all word-lane families.
  const THEMED_WORD_BANKS = {
    garden: [
      { w: "GARDEN", clue: "Where flowers grow" }, { w: "PETAL", clue: "Part of a flower" },
      { w: "BLOSSOM", clue: "A flower opening" }, { w: "ORCHID", clue: "An elegant flower" },
      { w: "LILAC", clue: "A soft purple flower" }, { w: "DAISY", clue: "A simple white flower" },
      { w: "TULIP", clue: "A cup-shaped spring flower" }, { w: "SEED", clue: "A new plant begins here" },
      { w: "FERN", clue: "A plant with feathery leaves" }, { w: "VINE", clue: "A climbing plant" }
    ],
    weather: [
      { w: "BREEZE", clue: "A gentle wind" }, { w: "SUNSET", clue: "Colours at the end of the day" },
      { w: "CLOUD", clue: "A soft shape in the sky" }, { w: "RAIN", clue: "Water falling from clouds" },
      { w: "MIST", clue: "A light veil in the air" }, { w: "FROST", clue: "A fine icy covering" },
      { w: "THUNDER", clue: "A deep sound after lightning" }, { w: "SNOW", clue: "Soft white winter flakes" },
      { w: "SUNNY", clue: "Bright with sunlight" }, { w: "DRIZZLE", clue: "Very light rain" }
    ],
    art: [
      { w: "CANVAS", clue: "A painter works on this" }, { w: "PALETTE", clue: "Holds a painter's colours" },
      { w: "BRUSH", clue: "Spreads paint in a picture" }, { w: "COLOUR", clue: "A hue such as blue or rose" },
      { w: "FRAME", clue: "A border around a picture" }, { w: "SKETCH", clue: "A light first drawing" },
      { w: "MURAL", clue: "A picture painted on a wall" }, { w: "SHADE", clue: "A lighter or darker colour" },
      { w: "PENCIL", clue: "A tool for drawing lines" }, { w: "PAINT", clue: "Colour applied with a brush" }
    ],
    kitchen: [
      { w: "KETTLE", clue: "Heats water for a warm drink" }, { w: "SPOON", clue: "Used for stirring or serving" },
      { w: "APRON", clue: "Protects clothes while cooking" }, { w: "BOWL", clue: "A round dish for food" },
      { w: "PLATE", clue: "A flat dish for a meal" }, { w: "WHISK", clue: "Mixes ingredients with loops" },
      { w: "OVEN", clue: "Bakes and roasts food" }, { w: "BREAD", clue: "A baked loaf" },
      { w: "HERBS", clue: "Fragrant leaves used in cooking" }, { w: "RECIPE", clue: "Steps for making a dish" }
    ],
    nature: [
      { w: "MEADOW", clue: "A grassy field" }, { w: "WILLOW", clue: "A graceful tree by water" },
      { w: "PEBBLE", clue: "A small smooth stone" }, { w: "MAPLE", clue: "A tree with red autumn leaves" },
      { w: "RIVER", clue: "Water flowing through the land" }, { w: "FOREST", clue: "A large place filled with trees" },
      { w: "OCEAN", clue: "A vast stretch of salt water" }, { w: "ROBIN", clue: "A small bird with a warm red breast" },
      { w: "ACORN", clue: "The seed of an oak tree" }, { w: "MOSS", clue: "A soft green woodland plant" }
    ]
  };
  const WORD_LIST = Object.values(THEMED_WORD_BANKS).flat();

  const WORD_SEARCH_THEMES = {
    botanical: ["BLOOM", "PETAL", "LEAF", "GARDEN", "STEM", "MEADOW", "TULIP", "DAISY", "SEED", "ROSE", "VINE", "FERN"],
    fineart: ["CANVAS", "COLOUR", "BRUSH", "SHAPE", "LIGHT", "SHADE", "LINES", "MURAL", "PALETTE", "PAINT", "FRAME", "SKETCH"],
    cozy: ["CANDLE", "BREEZE", "QUIET", "WARMTH", "MOON", "GLOW", "NIGHT", "CUSHION", "RIBBON", "REST", "DREAM", "HEARTH"]
  };
  const WORD_SEARCH_DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1]
  ];
  const MATCH_GLYPHS = ["🌸", "🌿", "☀", "☕", "🌙", "🍃", "🎨", "🌼", "🪨", "🕯", "🌊", "🍂"];
  const WORD_LADDERS = [
    [{ w: "COLD", clue: "Low in temperature" }, { w: "CORD", clue: "A strong string" }, { w: "CARD", clue: "A small piece of stiff paper" }, { w: "WARD", clue: "A section of a hospital" }, { w: "WARM", clue: "Pleasantly heated" }],
    [{ w: "LEAF", clue: "A green part of a plant" }, { w: "LOAF", clue: "A shaped piece of bread" }, { w: "LOAD", clue: "Something being carried" }, { w: "ROAD", clue: "A route for travelling" }, { w: "ROAM", clue: "To wander freely" }],
    [{ w: "MIST", clue: "A light veil in the air" }, { w: "MINT", clue: "A fresh green herb" }, { w: "MIND", clue: "Where thoughts happen" }, { w: "WIND", clue: "Moving air" }],
    [{ w: "SEED", clue: "A new plant begins here" }, { w: "FEED", clue: "To give food" }, { w: "FEEL", clue: "To notice by touch" }, { w: "FELL", clue: "Past tense of fall" }, { w: "FALL", clue: "To move downward" }],
    [{ w: "CLAY", clue: "Soft earth used for pottery" }, { w: "PLAY", clue: "To enjoy a game" }, { w: "PLOY", clue: "A clever plan" }, { w: "PLOT", clue: "The story of a book" }, { w: "SLOT", clue: "A narrow opening" }],
    [{ w: "DARK", clue: "With very little light" }, { w: "DARE", clue: "To be brave enough" }, { w: "CARE", clue: "Kind attention" }, { w: "CORE", clue: "The centre of something" }, { w: "COVE", clue: "A small sheltered bay" }],
    [{ w: "BELL", clue: "Something that rings" }, { w: "BELT", clue: "A band worn at the waist" }, { w: "MELT", clue: "To become liquid" }, { w: "MALT", clue: "A grain prepared for a warm drink" }],
    [{ w: "FORK", clue: "A tool with prongs" }, { w: "FORM", clue: "A shape or structure" }, { w: "FOAM", clue: "A mass of tiny bubbles" }, { w: "ROAM", clue: "To wander freely" }],
    [{ w: "ROSE", clue: "A fragrant garden flower" }, { w: "RISE", clue: "To move upward" }, { w: "RIDE", clue: "A journey on something" }, { w: "SIDE", clue: "An edge or surface" }],
    [{ w: "SNOW", clue: "Soft white winter flakes" }, { w: "SLOW", clue: "Not moving quickly" }, { w: "SLOT", clue: "A narrow opening" }, { w: "PLOT", clue: "The story of a book" }]
  ];

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function int(rng, n) { return Math.floor(rng() * n); }
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function wordBankFor(rng, opts) {
    opts = opts || {};
    if (opts.wordTheme && THEMED_WORD_BANKS[opts.wordTheme]) return THEMED_WORD_BANKS[opts.wordTheme];
    const groups = opts.theme === "botanical" ? ["garden", "nature"]
      : opts.theme === "fineart" ? ["art"]
        : opts.theme === "cozy" ? ["kitchen", "weather"]
          : Object.keys(THEMED_WORD_BANKS);
    return THEMED_WORD_BANKS[pick(rng, groups)];
  }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---- Glyph drawing (shared by the pattern puzzle) -----------------------
  function glyphSvg(g) {
    const c = g.color;
    let body = "";
    if (g.shape === "circle") body = `<circle cx="50" cy="50" r="${18 + g.size * 9}" fill="${c}"/>`;
    else if (g.shape === "square") {
      const s = 22 + g.size * 11;
      body = `<rect x="${50 - s}" y="${50 - s}" width="${s * 2}" height="${s * 2}" rx="6" fill="${c}" transform="rotate(${g.rot} 50 50)"/>`;
    } else if (g.shape === "triangle") {
      body = `<polygon points="50,18 82,78 18,78" fill="${c}" transform="rotate(${g.rot} 50 50)"/>`;
    } else if (g.shape === "dots") {
      const n = g.count;
      let dots = "";
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = 50 + Math.cos(a) * 22, y = 50 + Math.sin(a) * 22;
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" fill="${c}"/>`;
      }
      body = n === 1 ? `<circle cx="50" cy="50" r="9" fill="${c}"/>` : dots;
    }
    return `<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">${body}</svg>`;
  }
  function sameGlyph(a, b) {
    return a.shape === b.shape && a.color === b.color && a.count === b.count && a.rot === b.rot && a.size === b.size;
  }

  // ===== Pattern / rule-discovery puzzle ===================================
  function makePattern(rng) {
    const dimension = pick(rng, ["color", "count", "rotation", "size"]);
    const base = { shape: "circle", color: PALETTE[0], count: 3, rot: 0, size: 1 };
    let rule;

    if (dimension === "color") {
      base.shape = pick(rng, ["circle", "square", "triangle"]);
      const start = int(rng, PALETTE.length);
      rule = (step) => ({ ...base, color: PALETTE[(start + step) % PALETTE.length] });
    } else if (dimension === "count") {
      base.shape = "dots";
      const start = 1 + int(rng, 2);
      rule = (step) => ({ ...base, shape: "dots", count: start + step, color: base.color });
    } else if (dimension === "rotation") {
      base.shape = pick(rng, ["triangle", "square"]);
      const stepDeg = pick(rng, [45, 90]);
      rule = (step) => ({ ...base, rot: (step * stepDeg) % 360 });
    } else {
      base.shape = pick(rng, ["circle", "square"]);
      rule = (step) => ({ ...base, size: 0.6 + step * 0.5 });
    }

    const shown = [0, 1, 2, 3].map(rule);
    const answer = rule(4);

    // Distractors: perturb the changing dimension to clearly-wrong values.
    const wrongs = [];
    const tryAdd = (g) => { if (!sameGlyph(g, answer) && !wrongs.some((w) => sameGlyph(w, g))) wrongs.push(g); };
    if (dimension === "color") { for (const col of PALETTE) tryAdd({ ...answer, color: col }); }
    else if (dimension === "count") { for (const d of [-2, -1, 1, 2]) tryAdd({ ...answer, count: Math.max(1, answer.count + d) }); }
    else if (dimension === "rotation") { for (const d of [45, 90, 135, 180]) tryAdd({ ...answer, rot: (answer.rot + d) % 360 }); }
    else { for (const d of [-0.5, 0.5, 1]) tryAdd({ ...answer, size: Math.max(0.5, answer.size + d) }); }
    const choices = shuffle(rng, [answer, ...shuffle(rng, wrongs).slice(0, 3)]);

    const hints = [
      "One thing changes from tile to tile — colour, count, turn, or size. Which is it?",
      dimension === "color" ? "The colour follows a repeating order. What comes after the last one?"
        : dimension === "count" ? "Count the dots in each tile. They go up by one each time."
          : dimension === "rotation" ? "The shape turns the same amount each step."
            : "The shape grows a little each step.",
      "Pick the tile that keeps the change going — there's no penalty for trying."
    ];

    return {
      type: "pattern",
      title: "Which comes next?",
      rules: "These tiles follow a hidden rule. Tap the tile that continues the pattern.",
      hints,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const seq = el("div", "pz-seq");
        shown.forEach((g) => {
          const t = el("div", "pz-tile");
          t.innerHTML = glyphSvg(g);
          seq.appendChild(t);
        });
        const q = el("div", "pz-tile pz-tile--q", "?");
        seq.appendChild(q);
        root.appendChild(seq);

        const prompt = el("div", "pz-prompt", "Tap the answer:");
        root.appendChild(prompt);

        const opts = el("div", "pz-choices");
        let done = false;
        choices.forEach((g, optionIndex) => {
          const b = el("button", "pz-choice");
          b.type = "button";
          b.innerHTML = glyphSvg(g);
          b.setAttribute("aria-label", `answer option ${optionIndex + 1}`);
          b.addEventListener("click", () => {
            if (done) return;
            if (sameGlyph(g, answer)) {
              done = true;
              b.classList.add("is-correct");
              q.innerHTML = glyphSvg(answer);
              q.classList.remove("pz-tile--q");
              q.classList.add("is-revealed");
              prompt.textContent = "Lovely — that's it.";
              onSolved();
            } else {
              b.classList.add("is-wrong");
              prompt.textContent = "Not quite — take another look.";
              b.addEventListener("animationend", () => b.classList.remove("is-wrong"), { once: true });
            }
          });
          opts.appendChild(b);
        });
        root.appendChild(opts);
      }
    };
  }

  // ===== Art assembly (tile-swap restore) =================================
  function makeAssembly(rng, artwork) {
    const N = 3; // 3x3
    const total = N * N;
    const uri = window.BloomArt.dataUri(artwork.svg);

    // A non-identity scramble (any permutation is reachable by swaps).
    let order = shuffle(rng, Array.from({ length: total }, (_, i) => i));
    if (order.every((v, i) => v === i)) order = order.reverse();

    const hints = [
      "There's a small reference picture at the top — use it freely.",
      "Tap a tile, then tap where it should go, to swap the two.",
      "Corners are easiest to place first. No rush, no penalty."
    ];

    return {
      type: "assembly",
      title: "Restore the picture",
      rules: "The picture is shuffled. Tap two tiles to swap them until it's whole again.",
      hints,
      render(root, { onSolved }) {
        root.innerHTML = "";

        const ref = el("div", "pz-ref");
        ref.style.backgroundImage = `url("${uri}")`;
        ref.setAttribute("aria-label", `reference: ${artwork.title}`);
        root.appendChild(ref);
        root.appendChild(el("div", "pz-prompt", `Rebuild: ${artwork.title}`));

        const grid = el("div", "pz-grid");
        let selected = -1;
        let done = false;
        const cells = [];

        function paint() {
          for (let i = 0; i < total; i += 1) {
            const piece = order[i];
            const r = Math.floor(piece / N), c = piece % N;
            const cell = cells[i];
            cell.style.backgroundImage = `url("${uri}")`;
            cell.style.backgroundSize = `${N * 100}% ${N * 100}%`;
            cell.style.backgroundPosition = `${(c / (N - 1)) * 100}% ${(r / (N - 1)) * 100}%`;
            cell.classList.toggle("is-placed", piece === i);
            cell.classList.toggle("is-selected", i === selected);
          }
        }
        function check() {
          if (order.every((v, i) => v === i)) {
            done = true;
            grid.classList.add("is-complete");
            onSolved();
          }
        }

        for (let i = 0; i < total; i += 1) {
          const cell = el("button", "pz-cell");
          cell.type = "button";
          cell.setAttribute("aria-label", `tile ${i + 1}`);
          cell.addEventListener("click", () => {
            if (done) return;
            if (selected === -1) { selected = i; paint(); return; }
            if (selected === i) { selected = -1; paint(); return; }
            [order[selected], order[i]] = [order[i], order[selected]];
            selected = -1;
            paint();
            check();
          });
          cells.push(cell);
          grid.appendChild(cell);
        }
        root.appendChild(grid);
        paint();
      }
    };
  }

  // ===== Logic deduction (the anchor) =====================================
  // Three friends each planted a different flower in a different colour pot.
  // Clues are generated from a random solution, then trimmed to a non-redundant
  // set that is GUARANTEED to have exactly one answer (brute-forced over all 36
  // candidate solutions). The grid doubles as the elimination/notes scaffold.
  function makeLogic(rng) {
    const names = ["Mira", "Ada", "Lia"];
    const flowers = ["Rose", "Tulip", "Daisy"];
    const colors = ["Pink", "Yellow", "Blue"];

    const perms = [];
    (function gen(arr, acc) {
      if (!arr.length) { perms.push(acc); return; }
      for (let i = 0; i < arr.length; i += 1) gen(arr.slice(0, i).concat(arr.slice(i + 1)), acc.concat(arr[i]));
    })([0, 1, 2], []);

    const flowerOf = perms[int(rng, perms.length)]; // name i -> flower index
    const colorOf = perms[int(rng, perms.length)];  // name i -> colour index

    const candidates = [];
    for (const fp of perms) for (const cp of perms) candidates.push({ fp, cp });

    const clues = [];
    for (let i = 0; i < 3; i += 1) {
      const fIdx = flowerOf[i], cIdx = colorOf[i];
      clues.push({ text: `${names[i]} planted the ${flowers[fIdx].toLowerCase()}.`, test: (c) => c.fp[i] === fIdx });
      clues.push({ text: `${names[i]} used the ${colors[cIdx].toLowerCase()} pot.`, test: (c) => c.cp[i] === cIdx });
      for (let f = 0; f < 3; f += 1) if (f !== fIdx) clues.push({ text: `${names[i]} did not plant the ${flowers[f].toLowerCase()}.`, test: (c) => c.fp[i] !== f });
      for (let k = 0; k < 3; k += 1) if (k !== cIdx) clues.push({ text: `${names[i]} did not use the ${colors[k].toLowerCase()} pot.`, test: (c) => c.cp[i] !== k });
      clues.push({ text: `The ${flowers[fIdx].toLowerCase()} is in the ${colors[cIdx].toLowerCase()} pot.`, test: (c) => c.cp[c.fp.indexOf(fIdx)] === cIdx });
    }

    // Greedy non-redundant unique clue set.
    let remaining = candidates;
    const chosen = [];
    for (const clue of shuffle(rng, clues)) {
      const next = remaining.filter(clue.test);
      if (next.length < remaining.length) { chosen.push(clue); remaining = next; }
      if (remaining.length === 1) break;
    }

    const hints = [
      "Start with a clue that places someone for certain. Then mark the ✗ in the squares it rules out.",
      `Tip: ${names[0]} planted the ${flowers[flowerOf[0]].toLowerCase()}.`,
      `And ${names[0]} used the ${colors[colorOf[0]].toLowerCase()} pot — set those ✓ and work outward.`
    ];

    return {
      type: "logic",
      title: "Who planted what?",
      rules: "Three friends each planted a different flower in a different colour pot. Use the clues — tap a square to mark ✓ or ✗ — to fill in the grid.",
      hints,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "lg");

        const clueBox = el("div", "lg-clues");
        clueBox.appendChild(el("div", "t", "Clues"));
        chosen.forEach((c) => clueBox.appendChild(el("div", "lg-clue", c.text)));
        wrap.appendChild(clueBox);

        // marks: 0 blank, 1 yes, -1 no
        const markF = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        const markC = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        let done = false;
        const cellEls = { F: [], C: [] };

        function symbol(v) { return v === 1 ? "✓" : v === -1 ? "✗" : ""; }
        function repaint() {
          for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
            const cf = cellEls.F[i][j]; cf.textContent = symbol(markF[i][j]);
            cf.classList.toggle("yes", markF[i][j] === 1); cf.classList.toggle("no", markF[i][j] === -1);
            const cc = cellEls.C[i][j]; cc.textContent = symbol(markC[i][j]);
            cc.classList.toggle("yes", markC[i][j] === 1); cc.classList.toggle("no", markC[i][j] === -1);
          }
        }
        function solved() {
          for (let i = 0; i < 3; i += 1) for (let j = 0; j < 3; j += 1) {
            if ((markF[i][j] === 1) !== (j === flowerOf[i])) return false;
            if ((markC[i][j] === 1) !== (j === colorOf[i])) return false;
          }
          return true;
        }
        function buildGrid(title, cols, marks, store) {
          const sub = el("div", "lg-sub");
          sub.appendChild(el("div", "lg-title", title));
          const head = el("div", "lg-rowh");
          head.appendChild(el("div", "lg-colh", ""));
          cols.forEach((name) => head.appendChild(el("div", "lg-colh", name)));
          sub.appendChild(head);
          for (let i = 0; i < 3; i += 1) {
            const row = el("div", "lg-row");
            row.appendChild(el("div", "lg-rl", names[i]));
            store[i] = [];
            for (let j = 0; j < 3; j += 1) {
              const cell = el("button", "lg-cell");
              cell.type = "button";
              cell.setAttribute("aria-label", `${names[i]} — ${cols[j]}`);
              cell.addEventListener("click", () => {
                if (done) return;
                marks[i][j] = marks[i][j] === 0 ? 1 : marks[i][j] === 1 ? -1 : 0;
                repaint();
                if (solved()) { done = true; wrap.classList.add("is-solved"); onSolved(); }
              });
              store[i].push(cell);
              row.appendChild(cell);
            }
            sub.appendChild(row);
          }
          return sub;
        }
        wrap.appendChild(buildGrid("Flowers", flowers, markF, cellEls.F));
        wrap.appendChild(buildGrid("Pots", colors, markC, cellEls.C));
        wrap.appendChild(el("div", "lg-tip", "Tap a square: blank → ✓ → ✗ → blank"));
        root.appendChild(wrap);

        // Hints 2 & 3 also place a correct ✓ to gently unstick the player.
        root._applyHint = (level) => {
          if (done) return;
          if (level >= 2) { markF[0][flowerOf[0]] = 1; }
          if (level >= 3) { markC[0][colorOf[0]] = 1; }
          repaint();
          if (solved()) { done = true; wrap.classList.add("is-solved"); onSolved(); }
        };
      }
    };
  }

  // ===== Word play (scaffolded letter-bank unscramble) ====================
  function makeWord(rng, opts) {
    const item = pick(rng, opts && opts.wordTheme ? wordBankFor(rng, opts) : WORD_LIST);
    const target = item.w.toUpperCase();
    const letters = target.split("");
    let scrambled = shuffle(rng, letters);
    let guard = 0;
    while (scrambled.join("") === target && guard++ < 12) scrambled = shuffle(rng, letters);

    const hints = [
      `Clue: ${item.clue}.`,
      `It starts with “${target[0]}”.`,
      `It begins “${target.slice(0, Math.min(3, target.length))}…”.`
    ];

    return {
      type: "word",
      title: "Unscramble the word",
      rules: `${item.clue}. Tap letters to spell the word; tap a filled box to take it back.`,
      hints,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "wd");
        wrap.appendChild(el("div", "wd-clue", item.clue));
        const slotsEl = el("div", "wd-slots");
        const bankEl = el("div", "wd-bank");
        const slots = new Array(target.length).fill(null); // each holds a bank index
        const slotEls = [], keyEls = [];
        let done = false;

        function paint() {
          slots.forEach((bi, i) => {
            slotEls[i].textContent = bi == null ? "" : scrambled[bi];
            slotEls[i].classList.toggle("filled", bi != null);
          });
          keyEls.forEach((k, bi) => {
            const used = slots.indexOf(bi) !== -1;
            k.disabled = used; k.classList.toggle("used", used);
          });
        }
        function check() {
          if (slots.every((bi) => bi != null) && slots.map((bi) => scrambled[bi]).join("") === target) {
            done = true; wrap.classList.add("solved"); onSolved();
          }
        }
        function placeAt(slotIdx, letter) {
          if (slots[slotIdx] != null && scrambled[slots[slotIdx]] === letter) return;
          if (slots[slotIdx] != null) slots[slotIdx] = null;
          const bi = scrambled.findIndex((l, idx) => l === letter && slots.indexOf(idx) === -1);
          if (bi >= 0) slots[slotIdx] = bi;
        }

        for (let i = 0; i < target.length; i += 1) {
          const s = el("button", "wd-slot");
          s.type = "button";
          s.setAttribute("aria-label", `letter ${i + 1}`);
          s.addEventListener("click", () => { if (done) return; if (slots[i] != null) { slots[i] = null; paint(); } });
          slotEls.push(s); slotsEl.appendChild(s);
        }
        scrambled.forEach((ltr, bi) => {
          const k = el("button", "wd-key", ltr);
          k.type = "button";
          k.addEventListener("click", () => {
            if (done) return;
            const empty = slots.indexOf(null);
            if (empty === -1) return;
            slots[empty] = bi; paint(); check();
          });
          keyEls.push(k); bankEl.appendChild(k);
        });
        wrap.appendChild(slotsEl); wrap.appendChild(bankEl);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done) return;
          if (level >= 2) placeAt(0, target[0]);
          if (level >= 3 && target.length > 1) placeAt(1, target[1]);
          paint(); check();
        };
      }
    };
  }

  function validateAnagram(model) {
    if (!model || typeof model.target !== "string" || !Array.isArray(model.scrambled)) return false;
    if (model.target.length < 4 || model.scrambled.length !== model.target.length) return false;
    if (model.scrambled.join("") === model.target) return false;
    return model.scrambled.slice().sort().join("") === model.target.split("").sort().join("");
  }

  function makeAnagram(rng, opts) {
    opts = opts || {};
    const bank = wordBankFor(rng, opts);
    const difficulty = opts.difficulty || "standard";
    let candidates = bank.filter((item) => difficulty === "gentle" ? item.w.length <= 5
      : difficulty === "deep" ? item.w.length >= 6 : item.w.length >= 5 && item.w.length <= 6);
    if (!candidates.length) candidates = bank;
    const item = pick(rng, candidates);
    const target = item.w.toUpperCase();
    let scrambled = shuffle(rng, target.split(""));
    let guard = 0;
    while (scrambled.join("") === target && guard++ < 30) scrambled = shuffle(rng, target.split(""));
    if (scrambled.join("") === target) scrambled = target.slice(1).split("").concat(target[0]);
    const model = { target, scrambled, clue: item.clue, difficulty };
    if (!validateAnagram(model)) throw new Error("Could not build a valid anagram");

    return {
      type: "anagram",
      title: "Gather the letters",
      rules: `${item.clue}. Tap the letter bank to build the answer; tap a filled box to return a letter.`,
      hints: [
        `The answer means: ${item.clue.toLowerCase()}.`,
        `It starts with “${target[0]}”.`,
        `The first three letters are “${target.slice(0, Math.min(3, target.length))}”.`
      ],
      anagramModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "wd");
        wrap.appendChild(el("div", "wd-clue", item.clue));
        const slotsEl = el("div", "wd-slots");
        const bankEl = el("div", "wd-bank");
        const slots = new Array(target.length).fill(null);
        const slotEls = [], keyEls = [];
        let done = false;

        function paint() {
          slots.forEach((bankIndex, index) => {
            slotEls[index].textContent = bankIndex == null ? "" : scrambled[bankIndex];
            slotEls[index].classList.toggle("filled", bankIndex != null);
          });
          keyEls.forEach((key, bankIndex) => {
            const used = slots.indexOf(bankIndex) !== -1;
            key.disabled = used;
            key.classList.toggle("used", used);
          });
        }
        function check() {
          if (slots.every((bankIndex) => bankIndex != null) && slots.map((bankIndex) => scrambled[bankIndex]).join("") === target) {
            done = true;
            wrap.classList.add("solved");
            onSolved();
          }
        }
        function placeAt(slotIndex, letter) {
          if (slots[slotIndex] != null && scrambled[slots[slotIndex]] === letter) return;
          if (slots[slotIndex] != null) slots[slotIndex] = null;
          const bankIndex = scrambled.findIndex((candidate, index) => candidate === letter && slots.indexOf(index) === -1);
          if (bankIndex >= 0) slots[slotIndex] = bankIndex;
        }

        for (let index = 0; index < target.length; index += 1) {
          const slot = el("button", "wd-slot");
          slot.type = "button";
          slot.setAttribute("aria-label", `letter ${index + 1}`);
          slot.addEventListener("click", () => {
            if (!done && slots[index] != null) { slots[index] = null; paint(); }
          });
          slotEls.push(slot);
          slotsEl.appendChild(slot);
        }
        scrambled.forEach((letter, bankIndex) => {
          const key = el("button", "wd-key", letter);
          key.type = "button";
          key.addEventListener("click", () => {
            if (done) return;
            const empty = slots.indexOf(null);
            if (empty < 0) return;
            slots[empty] = bankIndex;
            paint();
            check();
          });
          keyEls.push(key);
          bankEl.appendChild(key);
        });
        wrap.appendChild(slotsEl);
        wrap.appendChild(bankEl);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done) return;
          if (level >= 2) placeAt(0, target[0]);
          if (level >= 3 && target.length > 1) placeAt(1, target[1]);
          paint();
          check();
        };
      }
    };
  }

  function letterDifference(a, b) {
    if (a.length !== b.length) return Infinity;
    let count = 0;
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) count += 1;
    return count;
  }

  function validateWordChain(model) {
    if (!model || !Array.isArray(model.chain) || model.chain.length < 3 || !Array.isArray(model.stages)) return false;
    if (model.stages.length !== model.chain.length - 1) return false;
    for (let i = 1; i < model.chain.length; i += 1) {
      if (letterDifference(model.chain[i - 1].w, model.chain[i].w) !== 1) return false;
      const stage = model.stages[i - 1];
      if (stage.from !== model.chain[i - 1].w || stage.target !== model.chain[i].w || stage.clue !== model.chain[i].clue) return false;
      if (!Array.isArray(stage.choices) || new Set(stage.choices).size !== stage.choices.length) return false;
      if (stage.choices.filter((choice) => choice === stage.target).length !== 1) return false;
    }
    return true;
  }

  function makeWordChain(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const source = pick(rng, WORD_LADDERS);
    const length = difficulty === "gentle" ? 3 : difficulty === "deep" ? source.length : Math.min(4, source.length);
    const chain = source.slice(0, length).map((entry) => ({ ...entry }));
    const vocabulary = Array.from(new Set(WORD_LADDERS.flat().map((entry) => entry.w)));
    const optionCount = difficulty === "gentle" ? 2 : difficulty === "deep" ? 4 : 3;
    const stages = [];
    for (let i = 1; i < chain.length; i += 1) {
      const from = chain[i - 1].w;
      const target = chain[i].w;
      const near = shuffle(rng, vocabulary.filter((word) => word !== target && word.length === target.length && letterDifference(from, word) === 1));
      const other = shuffle(rng, vocabulary.filter((word) => word !== target && word.length === target.length && !near.includes(word)));
      const distractors = near.concat(other).slice(0, optionCount - 1);
      stages.push({ from, target, clue: chain[i].clue, choices: shuffle(rng, [target, ...distractors]) });
    }
    const model = { difficulty, chain, stages };
    if (!validateWordChain(model)) throw new Error("Could not build a valid word ladder");

    return {
      type: "wordchain",
      title: "Change one letter",
      rules: "Build a word ladder. Each next answer changes exactly one letter; use the small clue to choose it.",
      hints: [
        "Compare the current word with each choice one letter at a time.",
        "The softly outlined choice fits the next clue.",
        "Only one letter changes at each step."
      ],
      wordChainModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "ladder");
        const trail = el("div", "ladder-trail");
        const clue = el("div", "ladder-clue");
        const choices = el("div", "ladder-choices");
        const status = el("div", "ladder-status muted", "Start with the clue below.");
        status.setAttribute("aria-live", "polite");
        let step = 0;
        let done = false;

        function paintTrail() {
          trail.innerHTML = "";
          model.chain.forEach((entry, index) => {
            const row = el("div", "ladder-word", index <= step ? entry.w : "· · · ·");
            if (index === step) row.classList.add("is-current");
            trail.appendChild(row);
          });
        }
        function paintStage() {
          paintTrail();
          choices.innerHTML = "";
          if (step >= model.stages.length) {
            done = true;
            clue.textContent = "The ladder is complete.";
            status.textContent = "A whole path of words - lovely.";
            wrap.classList.add("is-complete");
            onSolved();
            return;
          }
          const stage = model.stages[step];
          clue.innerHTML = `<strong>Next clue:</strong> ${stage.clue}`;
          stage.choices.forEach((word) => {
            const button = el("button", "ladder-choice", word);
            button.type = "button";
            button.dataset.word = word;
            button.addEventListener("click", () => {
              if (done) return;
              if (word !== stage.target) {
                status.textContent = "That word does not fit this clue - try another.";
                return;
              }
              step += 1;
              status.textContent = "One letter changed.";
              paintStage();
            });
            choices.appendChild(button);
          });
        }
        wrap.appendChild(trail);
        wrap.appendChild(clue);
        wrap.appendChild(choices);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paintStage();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          choices.querySelectorAll(".ladder-choice").forEach((button) => button.classList.toggle("is-hint", button.dataset.word === model.stages[step].target));
          status.textContent = "The softly outlined word fits the clue.";
        };
      }
    };
  }

  function validateCrosswordLite(model) {
    if (!model || !Array.isArray(model.entries) || model.entries.length !== 2) return false;
    const across = model.entries.find((entry) => entry.direction === "across");
    const down = model.entries.find((entry) => entry.direction === "down");
    if (!across || !down || across.word === down.word || across.clue === down.clue) return false;
    if (across.row !== down.crossIndex || down.col !== across.crossIndex) return false;
    if (across.word[across.crossIndex] !== down.word[down.crossIndex]) return false;
    if (model.rows !== down.word.length || model.cols !== across.word.length) return false;
    const seen = new Map();
    for (const entry of model.entries) {
      for (let i = 0; i < entry.word.length; i += 1) {
        const row = entry.row + (entry.direction === "down" ? i : 0);
        const col = entry.col + (entry.direction === "across" ? i : 0);
        const key = row + "-" + col;
        if (seen.has(key) && seen.get(key) !== entry.word[i]) return false;
        seen.set(key, entry.word[i]);
      }
    }
    return seen.size === across.word.length + down.word.length - 1;
  }

  function makeCrosswordLite(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const bank = wordBankFor(rng, opts);
    let candidates = bank.filter((item) => difficulty === "gentle" ? item.w.length <= 5
      : difficulty === "deep" ? item.w.length >= 6 : item.w.length >= 5 && item.w.length <= 6);
    if (candidates.length < 2) candidates = bank;
    const possible = [];
    for (const across of candidates) {
      for (const down of candidates) {
        if (across.w === down.w) continue;
        for (let ai = 0; ai < across.w.length; ai += 1) {
          for (let di = 0; di < down.w.length; di += 1) {
            if (across.w[ai] === down.w[di]) possible.push({ across, down, ai, di });
          }
        }
      }
    }
    if (!possible.length) throw new Error("Could not find a crossword intersection");
    const chosen = pick(rng, possible);
    const entries = [
      { id: "across", direction: "across", word: chosen.across.w, clue: chosen.across.clue, row: chosen.di, col: 0, crossIndex: chosen.ai },
      { id: "down", direction: "down", word: chosen.down.w, clue: chosen.down.clue, row: 0, col: chosen.ai, crossIndex: chosen.di }
    ];
    const model = {
      difficulty,
      rows: chosen.down.w.length,
      cols: chosen.across.w.length,
      sharedLetter: chosen.across.w[chosen.ai],
      entries,
      choices: shuffle(rng, entries.map((entry) => entry.word))
    };
    if (!validateCrosswordLite(model)) throw new Error("Could not build a valid crossword");

    return {
      type: "crossword",
      title: "A small word cross",
      rules: "Two answers share one letter. Choose a clue, then choose its word to fill the little cross.",
      hints: [
        `The shared letter is ${model.sharedLetter}.`,
        "The softly outlined word answers the selected clue.",
        "A hint can place one answer; there is no penalty."
      ],
      crosswordModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "crossword");
        const grid = el("div", "cross-grid");
        grid.style.setProperty("--cross-cols", model.cols);
        const clueList = el("div", "cross-clues");
        const bankEl = el("div", "cross-bank");
        const status = el("div", "cross-status muted", "Choose either clue.");
        status.setAttribute("aria-live", "polite");
        const solved = new Set();
        const cells = new Map();
        const clueButtons = new Map();
        let active = model.entries[0].id;
        let done = false;

        function entryCells(entry) {
          return Array.from({ length: entry.word.length }, (_, i) => ({
            row: entry.row + (entry.direction === "down" ? i : 0),
            col: entry.col + (entry.direction === "across" ? i : 0),
            letter: entry.word[i]
          }));
        }
        const used = new Map();
        model.entries.forEach((entry) => entryCells(entry).forEach((cell) => used.set(cell.row + "-" + cell.col, cell.letter)));
        for (let row = 0; row < model.rows; row += 1) {
          for (let col = 0; col < model.cols; col += 1) {
            const key = row + "-" + col;
            const cell = el("div", used.has(key) ? "cross-cell" : "cross-block");
            if (used.has(key)) {
              cell.setAttribute("aria-label", `row ${row + 1}, column ${col + 1}`);
              cells.set(key, cell);
            }
            grid.appendChild(cell);
          }
        }

        function paint() {
          cells.forEach((cell, key) => {
            let letter = "";
            const belongs = model.entries.filter((entry) => entryCells(entry).some((p) => p.row + "-" + p.col === key));
            if (belongs.some((entry) => solved.has(entry.id)) || belongs.length === 2) letter = used.get(key);
            cell.textContent = letter;
            cell.classList.toggle("is-filled", !!letter);
          });
          clueButtons.forEach((button, id) => {
            button.classList.toggle("is-active", id === active && !solved.has(id));
            button.classList.toggle("is-solved", solved.has(id));
          });
          bankEl.querySelectorAll(".cross-word").forEach((button) => button.classList.remove("is-hint"));
        }
        function fill(entry) {
          if (solved.has(entry.id)) return;
          solved.add(entry.id);
          const next = model.entries.find((candidate) => !solved.has(candidate.id));
          active = next ? next.id : null;
          paint();
          if (!next) {
            done = true;
            wrap.classList.add("is-complete");
            status.textContent = "Both words meet in the middle.";
            onSolved();
          } else {
            status.textContent = "That fits. One clue remains.";
          }
        }

        model.entries.forEach((entry, index) => {
          const button = el("button", "cross-clue", `<strong>${index + 1} ${entry.direction}</strong><span>${entry.clue}</span>`);
          button.type = "button";
          button.addEventListener("click", () => {
            if (done || solved.has(entry.id)) return;
            active = entry.id;
            status.textContent = "Now choose the matching word.";
            paint();
          });
          clueButtons.set(entry.id, button);
          clueList.appendChild(button);
        });
        model.choices.forEach((word) => {
          const button = el("button", "cross-word", word);
          button.type = "button";
          button.dataset.word = word;
          button.addEventListener("click", () => {
            if (done || !active) return;
            const entry = model.entries.find((candidate) => candidate.id === active);
            if (word !== entry.word) {
              status.textContent = "That word belongs to the other clue - try the other one.";
              return;
            }
            fill(entry);
          });
          bankEl.appendChild(button);
        });

        wrap.appendChild(grid);
        wrap.appendChild(clueList);
        wrap.appendChild(bankEl);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done || !active || level < 2) return;
          const entry = model.entries.find((candidate) => candidate.id === active);
          const answerButton = Array.from(bankEl.querySelectorAll(".cross-word")).find((button) => button.dataset.word === entry.word);
          if (level >= 3) fill(entry);
          else if (answerButton) answerButton.classList.add("is-hint");
        };
      }
    };
  }

  function sudokuChoices(board, index, size, boxRows, boxCols) {
    if (board[index]) return [];
    const row = Math.floor(index / size), col = index % size;
    const used = new Set();
    for (let i = 0; i < size; i += 1) {
      used.add(board[row * size + i]);
      used.add(board[i * size + col]);
    }
    const rowStart = Math.floor(row / boxRows) * boxRows;
    const colStart = Math.floor(col / boxCols) * boxCols;
    for (let r = rowStart; r < rowStart + boxRows; r += 1) {
      for (let c = colStart; c < colStart + boxCols; c += 1) used.add(board[r * size + c]);
    }
    const choices = [];
    for (let value = 1; value <= size; value += 1) if (!used.has(value)) choices.push(value);
    return choices;
  }

  function countSudokuSolutions(input, size, boxRows, boxCols, limit) {
    const board = input.slice();
    const stopAt = limit || 2;
    let count = 0;
    function solve() {
      if (count >= stopAt) return;
      let bestIndex = -1, bestChoices = null;
      for (let index = 0; index < board.length; index += 1) {
        if (board[index]) continue;
        const choices = sudokuChoices(board, index, size, boxRows, boxCols);
        if (!choices.length) return;
        if (!bestChoices || choices.length < bestChoices.length) {
          bestIndex = index;
          bestChoices = choices;
          if (choices.length === 1) break;
        }
      }
      if (bestIndex < 0) { count += 1; return; }
      for (const value of bestChoices) {
        board[bestIndex] = value;
        solve();
        board[bestIndex] = 0;
        if (count >= stopAt) return;
      }
    }
    solve();
    return count;
  }

  function validSudokuSolution(solution, size, boxRows, boxCols) {
    const wanted = Array.from({ length: size }, (_, i) => i + 1).join(",");
    for (let row = 0; row < size; row += 1) {
      if (solution.slice(row * size, row * size + size).slice().sort((a, b) => a - b).join(",") !== wanted) return false;
    }
    for (let col = 0; col < size; col += 1) {
      const values = [];
      for (let row = 0; row < size; row += 1) values.push(solution[row * size + col]);
      if (values.sort((a, b) => a - b).join(",") !== wanted) return false;
    }
    for (let rs = 0; rs < size; rs += boxRows) {
      for (let cs = 0; cs < size; cs += boxCols) {
        const values = [];
        for (let row = rs; row < rs + boxRows; row += 1) for (let col = cs; col < cs + boxCols; col += 1) values.push(solution[row * size + col]);
        if (values.sort((a, b) => a - b).join(",") !== wanted) return false;
      }
    }
    return true;
  }

  function validateSudoku(model) {
    if (!model || ![4, 6].includes(model.size) || !Array.isArray(model.puzzle) || !Array.isArray(model.solution)) return false;
    if (model.puzzle.length !== model.size * model.size || model.solution.length !== model.puzzle.length) return false;
    if (!validSudokuSolution(model.solution, model.size, model.boxRows, model.boxCols)) return false;
    for (let i = 0; i < model.puzzle.length; i += 1) if (model.puzzle[i] && model.puzzle[i] !== model.solution[i]) return false;
    return countSudokuSolutions(model.puzzle, model.size, model.boxRows, model.boxCols, 2) === 1;
  }

  function makeSudoku(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const size = difficulty === "gentle" ? 4 : difficulty === "deep" ? 6 : (rng() < 0.5 ? 4 : 6);
    const boxRows = 2, boxCols = size / boxRows;
    const numbers = shuffle(rng, Array.from({ length: size }, (_, i) => i + 1));
    const bands = shuffle(rng, Array.from({ length: size / boxRows }, (_, i) => i));
    const stacks = shuffle(rng, Array.from({ length: size / boxCols }, (_, i) => i));
    const rows = bands.flatMap((band) => shuffle(rng, Array.from({ length: boxRows }, (_, i) => band * boxRows + i)));
    const cols = stacks.flatMap((stack) => shuffle(rng, Array.from({ length: boxCols }, (_, i) => stack * boxCols + i)));
    const pattern = (row, col) => (boxCols * (row % boxRows) + Math.floor(row / boxRows) + col) % size;
    const solution = [];
    rows.forEach((row) => cols.forEach((col) => solution.push(numbers[pattern(row, col)])));
    const puzzle = solution.slice();
    const targetClues = size === 4 ? (difficulty === "gentle" ? 10 : 7) : (difficulty === "deep" ? 16 : 21);
    for (const index of shuffle(rng, Array.from({ length: puzzle.length }, (_, i) => i))) {
      if (puzzle.filter(Boolean).length <= targetClues) break;
      const previous = puzzle[index];
      puzzle[index] = 0;
      if (countSudokuSolutions(puzzle, size, boxRows, boxCols, 2) !== 1) puzzle[index] = previous;
    }
    const model = { difficulty, size, boxRows, boxCols, puzzle, solution };
    if (!validateSudoku(model)) throw new Error("Could not build a unique mini-sudoku");

    return {
      type: "sudoku",
      title: `${size}×${size} mini-sudoku`,
      rules: "Fill each row, column, and outlined region with each number once. Select a square, then choose a number.",
      hints: [
        "Start with a row, column, or region that has only one number missing.",
        "A one-step hint will fill one square without any penalty.",
        "Candidate mode lets you keep small possible numbers in a square."
      ],
      sudokuModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "sudoku");
        const toolbar = el("div", "sudoku-tools");
        const candidateBtn = el("button", "sudoku-tool", "Candidate marks: off");
        const contradictionBtn = el("button", "sudoku-tool", "Show contradictions");
        const grid = el("div", "sudoku-grid");
        grid.style.setProperty("--sdk-size", size);
        grid.style.setProperty("--sdk-box-cols", boxCols);
        const numberPad = el("div", "sudoku-pad");
        numberPad.style.setProperty("--sdk-size", size);
        const status = el("div", "sudoku-status muted", "Choose an empty square.");
        status.setAttribute("aria-live", "polite");
        const values = model.puzzle.slice();
        const candidates = new Map();
        const cells = [];
        let active = model.puzzle.findIndex((value) => !value);
        let candidateMode = false;
        let showContradictions = false;
        let done = false;

        function peers(a, b) {
          const ar = Math.floor(a / size), ac = a % size, br = Math.floor(b / size), bc = b % size;
          return ar === br || ac === bc || (Math.floor(ar / boxRows) === Math.floor(br / boxRows) && Math.floor(ac / boxCols) === Math.floor(bc / boxCols));
        }
        function paint() {
          cells.forEach((cell, index) => {
            const value = values[index];
            const marks = candidates.get(index);
            cell.innerHTML = value ? String(value) : marks && marks.size ? `<span class="sudoku-marks">${Array.from(marks).sort().join(" ")}</span>` : "";
            cell.classList.toggle("is-active", index === active);
            cell.classList.toggle("is-peer", active >= 0 && index !== active && peers(index, active));
            cell.classList.toggle("is-given", !!model.puzzle[index]);
            cell.classList.toggle("is-contradiction", showContradictions && !!value && value !== model.solution[index]);
          });
          candidateBtn.textContent = `Candidate marks: ${candidateMode ? "on" : "off"}`;
          candidateBtn.classList.toggle("is-active", candidateMode);
          contradictionBtn.textContent = showContradictions ? "Hide contradictions" : "Show contradictions";
        }
        function check() {
          if (values.every((value, index) => value === model.solution[index])) {
            done = true;
            wrap.classList.add("is-complete");
            status.textContent = "Every row, column, and region fits.";
            onSolved();
          }
        }
        function place(value) {
          if (done || active < 0 || model.puzzle[active]) return;
          if (candidateMode && value) {
            const marks = candidates.get(active) || new Set();
            if (marks.has(value)) marks.delete(value); else marks.add(value);
            candidates.set(active, marks);
            status.textContent = "Candidate marks updated.";
          } else {
            values[active] = value;
            candidates.delete(active);
            status.textContent = value ? "Number placed." : "Square cleared.";
          }
          paint();
          check();
        }

        for (let index = 0; index < values.length; index += 1) {
          const row = Math.floor(index / size), col = index % size;
          const cell = el("button", "sudoku-cell");
          cell.type = "button";
          cell.disabled = !!model.puzzle[index];
          cell.setAttribute("aria-label", model.puzzle[index] ? `given ${values[index]}` : `row ${row + 1}, column ${col + 1}`);
          if ((col + 1) % boxCols === 0 && col + 1 < size) cell.classList.add("box-right");
          if ((row + 1) % boxRows === 0 && row + 1 < size) cell.classList.add("box-bottom");
          cell.addEventListener("click", () => { if (!done) { active = index; paint(); } });
          cells.push(cell);
          grid.appendChild(cell);
        }
        for (let value = 1; value <= size; value += 1) {
          const button = el("button", "sudoku-number", value);
          button.type = "button";
          button.addEventListener("click", () => place(value));
          numberPad.appendChild(button);
        }
        const clear = el("button", "sudoku-number clear", "Clear");
        clear.type = "button";
        clear.addEventListener("click", () => place(0));
        numberPad.appendChild(clear);
        candidateBtn.type = "button";
        candidateBtn.addEventListener("click", () => { candidateMode = !candidateMode; paint(); });
        contradictionBtn.type = "button";
        contradictionBtn.addEventListener("click", () => { showContradictions = !showContradictions; paint(); });
        toolbar.appendChild(candidateBtn);
        toolbar.appendChild(contradictionBtn);
        wrap.appendChild(toolbar);
        wrap.appendChild(grid);
        wrap.appendChild(numberPad);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          let index = active >= 0 && !model.puzzle[active] && values[active] !== model.solution[active] ? active : values.findIndex((value, i) => value !== model.solution[i] && !model.puzzle[i]);
          if (index < 0) return;
          active = index;
          values[index] = model.solution[index];
          candidates.delete(index);
          status.textContent = `A ${model.solution[index]} fits here.`;
          paint();
          check();
        };
      }
    };
  }

  function validateSpotDifference(model) {
    if (!model || model.gridSize !== 3 || !Array.isArray(model.differences) || !Array.isArray(model.markers)) return false;
    if (model.differences.length < 2 || model.differences.length > 4 || new Set(model.differences).size !== model.differences.length) return false;
    if (model.markers.length !== model.differences.length) return false;
    return model.markers.every((marker) => model.differences.includes(marker.index) && marker.index >= 0 && marker.index < 9 && typeof marker.glyph === "string");
  }

  function makeSpotDifference(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const differenceCount = difficulty === "gentle" ? 2 : difficulty === "deep" ? 4 : 3;
    const differences = shuffle(rng, Array.from({ length: 9 }, (_, i) => i)).slice(0, differenceCount).sort((a, b) => a - b);
    const glyphs = ["●", "◆", "✦", "▲", "■"];
    const markers = differences.map((index) => ({ index, glyph: pick(rng, glyphs), color: pick(rng, PALETTE) }));
    const model = { difficulty, gridSize: 3, differences, markers };
    if (!validateSpotDifference(model)) throw new Error("Could not build clear art differences");
    const artwork = opts.artwork || (window.BloomArt && window.BloomArt.byIndex ? window.BloomArt.byIndex(0) : null);

    return {
      type: "spot",
      title: "Notice the gentle changes",
      rules: "Compare the two pictures. Tap each clear shape that appears only in the right picture.",
      hints: [
        "Look at one small square of the picture at a time.",
        "A soft outline will show the area of one remaining change.",
        "Every change is a clear added shape - nothing is hidden in tiny detail."
      ],
      spotModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "spot");
        const panels = el("div", "spot-panels");
        const reference = el("div", "spot-panel");
        const changed = el("div", "spot-panel changed");
        const uri = artwork && window.BloomArt ? window.BloomArt.dataUri(artwork.svg) : "";
        reference.style.backgroundImage = `url("${uri}")`;
        changed.style.backgroundImage = `url("${uri}")`;
        reference.setAttribute("aria-label", "reference artwork");
        const grid = el("div", "spot-grid");
        const buttons = [];
        const found = new Set();
        const status = el("div", "spot-status muted", `Find ${differenceCount} clear change${differenceCount === 1 ? "" : "s"}.`);
        status.setAttribute("aria-live", "polite");
        let done = false;

        for (let index = 0; index < 9; index += 1) {
          const button = el("button", "spot-cell");
          button.type = "button";
          button.setAttribute("aria-label", `picture area ${index + 1}`);
          const marker = model.markers.find((item) => item.index === index);
          if (marker) {
            const shape = el("span", "spot-change", marker.glyph);
            shape.style.color = marker.color;
            button.appendChild(shape);
          }
          button.addEventListener("click", () => {
            if (done || found.has(index)) return;
            if (!model.differences.includes(index)) {
              status.textContent = "Nothing changed there - compare another area.";
              return;
            }
            found.add(index);
            button.classList.add("is-found");
            status.textContent = `Change found. ${differenceCount - found.size} remaining.`;
            if (found.size === differenceCount) {
              done = true;
              wrap.classList.add("is-complete");
              status.textContent = "Every gentle change found.";
              onSolved();
            }
          });
          buttons.push(button);
          grid.appendChild(button);
        }
        changed.appendChild(grid);
        panels.appendChild(reference);
        panels.appendChild(changed);
        wrap.appendChild(panels);
        wrap.appendChild(status);
        root.appendChild(wrap);

        root._applyHint = (level) => {
          if (done || level < 2) return;
          buttons.forEach((button) => button.classList.remove("is-hint"));
          const next = model.differences.find((index) => !found.has(index));
          if (next != null) {
            buttons[next].classList.add("is-hint");
            status.textContent = "Look in the softly outlined area.";
          }
        };
      }
    };
  }

  const MEMORY_PAIRS = [
    { glyphs: ["🌱", "🌸"], label: "growing garden" },
    { glyphs: ["☁️", "🌧️"], label: "rainy sky" },
    { glyphs: ["🎨", "🖌️"], label: "making art" },
    { glyphs: ["☕", "🫖"], label: "tea time" },
    { glyphs: ["🌙", "⭐"], label: "night sky" },
    { glyphs: ["🍂", "🌳"], label: "autumn tree" },
    { glyphs: ["🪨", "🌊"], label: "quiet shore" },
    { glyphs: ["🥣", "🥄"], label: "kitchen pair" },
    { glyphs: ["🐝", "🌼"], label: "garden visitors" },
    { glyphs: ["🧶", "🪡"], label: "handmade things" }
  ];

  function validateMemory(model) {
    if (!model || !Array.isArray(model.cards) || !Number.isInteger(model.pairCount)) return false;
    if (model.pairCount < 4 || model.pairCount > 8 || model.cards.length !== model.pairCount * 2) return false;
    if (new Set(model.cards.map((card) => card.id)).size !== model.cards.length) return false;
    const groups = new Map();
    for (const card of model.cards) {
      if (!Number.isInteger(card.pair) || typeof card.glyph !== "string" || typeof card.label !== "string") return false;
      const group = groups.get(card.pair) || [];
      group.push(card);
      groups.set(card.pair, group);
    }
    return groups.size === model.pairCount && Array.from(groups.values()).every((group) => group.length === 2 && group[0].label === group[1].label && group[0].glyph !== group[1].glyph);
  }

  function makeMemory(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const pairCount = difficulty === "gentle" ? 4 : difficulty === "deep" ? 8 : 6;
    const chosen = shuffle(rng, MEMORY_PAIRS).slice(0, pairCount);
    const cards = shuffle(rng, chosen.flatMap((pair, pairIndex) => pair.glyphs.map((glyph, side) => ({
      id: `${pairIndex}-${side}`,
      pair: pairIndex,
      glyph,
      label: pair.label
    }))));
    const model = { difficulty, pairCount, cards };
    if (!validateMemory(model)) throw new Error("Could not build a complete memory board");

    return {
      type: "memory",
      title: "Art memory pairs",
      rules: "Turn over two cards. Companions such as a brush and palette belong together. Matched pairs stay open.",
      hints: [
        "Use Preview positions whenever you would like to look at the whole board.",
        "A soft outline can keep the positions of one pair visible.",
        "There is no cost for turning over cards that do not belong together."
      ],
      memoryModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "memory");
        const previewButton = el("button", "memory-preview", "Preview positions");
        const grid = el("div", "memory-grid");
        const status = el("div", "memory-status muted", "Choose any card to begin.");
        status.setAttribute("aria-live", "polite");
        const buttons = [];
        const matched = new Set();
        let active = null;
        let mismatch = [];
        let preview = false;
        let hintPair = null;
        let done = false;

        function isOpen(index) {
          return preview || matched.has(model.cards[index].pair) || active === index || mismatch.includes(index);
        }
        function paint() {
          buttons.forEach((button, index) => {
            const card = model.cards[index];
            const open = isOpen(index);
            button.textContent = open ? card.glyph : "✦";
            button.classList.toggle("is-open", open);
            button.classList.toggle("is-matched", matched.has(card.pair));
            button.classList.toggle("is-hint", hintPair === card.pair && !matched.has(card.pair));
            button.setAttribute("aria-label", open ? `${card.glyph}, ${card.label}` : `face-down card ${index + 1}`);
          });
          previewButton.textContent = preview ? "Hide preview" : "Preview positions";
          previewButton.setAttribute("aria-pressed", String(preview));
        }
        function turn(index) {
          if (done || preview || matched.has(model.cards[index].pair)) return;
          if (mismatch.length) {
            mismatch = [];
            active = null;
          }
          if (active === index) {
            active = null;
            status.textContent = "Card turned back over.";
            paint();
            return;
          }
          if (active == null) {
            active = index;
            status.textContent = "Now choose its companion.";
            paint();
            return;
          }
          const first = active;
          active = null;
          if (model.cards[first].pair === model.cards[index].pair) {
            const pair = model.cards[index].pair;
            matched.add(pair);
            if (hintPair === pair) hintPair = null;
            status.textContent = `${model.cards[index].label} found. ${model.pairCount - matched.size} pairs remain.`;
            if (matched.size === model.pairCount) {
              done = true;
              wrap.classList.add("is-complete");
              status.textContent = "Every companion pair is together.";
              onSolved();
            }
          } else {
            mismatch = [first, index];
            status.textContent = "Those are different. Choose a card when you are ready to continue.";
          }
          paint();
        }

        model.cards.forEach((card, index) => {
          const button = el("button", "memory-card", "✦");
          button.type = "button";
          button.addEventListener("click", () => turn(index));
          buttons.push(button);
          grid.appendChild(button);
        });
        previewButton.type = "button";
        previewButton.addEventListener("click", () => {
          if (done) return;
          preview = !preview;
          mismatch = [];
          active = null;
          status.textContent = preview ? "Take all the time you like to look." : "Cards are face down again.";
          paint();
        });
        wrap.appendChild(previewButton);
        wrap.appendChild(grid);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          const next = model.cards.find((card) => !matched.has(card.pair));
          if (!next) return;
          hintPair = next.pair;
          status.textContent = "Two softly outlined positions belong together.";
          paint();
        };
      }
    };
  }

  function nonogramClue(line) {
    const clue = [];
    let run = 0;
    line.forEach((value) => {
      if (value) run += 1;
      else if (run) { clue.push(run); run = 0; }
    });
    if (run) clue.push(run);
    return clue.length ? clue : [0];
  }

  function nonogramLinePatterns(clue, size) {
    const patterns = [];
    for (let mask = 0; mask < (1 << size); mask += 1) {
      const line = Array.from({ length: size }, (_, index) => (mask >> (size - index - 1)) & 1);
      if (nonogramClue(line).join(",") === clue.join(",")) patterns.push(line);
    }
    return patterns;
  }

  function countNonogramSolutions(model, limit) {
    if (!model || !Array.isArray(model.rowClues) || !Array.isArray(model.colClues)) return 0;
    const size = model.size;
    const rowOptions = model.rowClues.map((clue) => nonogramLinePatterns(clue, size));
    const colOptions = model.colClues.map((clue) => nonogramLinePatterns(clue, size));
    if (rowOptions.some((options) => !options.length) || colOptions.some((options) => !options.length)) return 0;
    const rows = [];
    const stopAt = limit || 2;
    let count = 0;
    function search(rowIndex) {
      if (count >= stopAt) return;
      if (rowIndex === size) { count += 1; return; }
      for (const candidate of rowOptions[rowIndex]) {
        rows.push(candidate);
        let possible = true;
        for (let col = 0; col < size && possible; col += 1) {
          const prefix = rows.map((row) => row[col]);
          possible = colOptions[col].some((option) => prefix.every((value, index) => option[index] === value));
        }
        if (possible) search(rowIndex + 1);
        rows.pop();
        if (count >= stopAt) return;
      }
    }
    search(0);
    return count;
  }

  function validateNonogram(model) {
    if (!model || model.size !== 5 || !Array.isArray(model.solution) || model.solution.length !== 25) return false;
    if (!model.solution.every((value) => value === 0 || value === 1)) return false;
    if (!Array.isArray(model.rowClues) || !Array.isArray(model.colClues) || model.rowClues.length !== 5 || model.colClues.length !== 5) return false;
    for (let row = 0; row < 5; row += 1) {
      if (nonogramClue(model.solution.slice(row * 5, row * 5 + 5)).join(",") !== model.rowClues[row].join(",")) return false;
    }
    for (let col = 0; col < 5; col += 1) {
      const line = Array.from({ length: 5 }, (_, row) => model.solution[row * 5 + col]);
      if (nonogramClue(line).join(",") !== model.colClues[col].join(",")) return false;
    }
    return countNonogramSolutions(model, 2) === 1;
  }

  function makeNonogram(rng, opts) {
    opts = opts || {};
    const size = 5;
    let model = null;
    for (let attempt = 0; attempt < 120 && !model; attempt += 1) {
      const density = 0.34 + rng() * 0.32;
      const solution = Array.from({ length: 25 }, () => rng() < density ? 1 : 0);
      const filled = solution.reduce((sum, value) => sum + value, 0);
      if (filled < 6 || filled > 19) continue;
      const rowClues = Array.from({ length: size }, (_, row) => nonogramClue(solution.slice(row * size, row * size + size)));
      const colClues = Array.from({ length: size }, (_, col) => nonogramClue(Array.from({ length: size }, (_, row) => solution[row * size + col])));
      const candidate = { size, solution, rowClues, colClues };
      if (validateNonogram(candidate)) model = candidate;
    }
    if (!model) {
      const solution = [0,1,1,1,0, 1,0,1,0,1, 1,1,1,1,1, 0,1,1,1,0, 0,0,1,0,0];
      model = {
        size,
        solution,
        rowClues: Array.from({ length: size }, (_, row) => nonogramClue(solution.slice(row * size, row * size + size))),
        colClues: Array.from({ length: size }, (_, col) => nonogramClue(Array.from({ length: size }, (_, row) => solution[row * size + col])))
      };
    }
    if (!validateNonogram(model)) throw new Error("Could not build a unique Picross board");
    const artwork = opts.artwork;

    return {
      type: "nonogram",
      title: "Tiny picture clues",
      rules: "Each number describes a run of filled squares in that row or column. Tap a square once to fill it, and again to mark it empty.",
      hints: [
        "A 5 clue fills the whole row or column.",
        "A soft hint can place one certain square for you.",
        "Marks are optional; use them to remember squares that stay empty."
      ],
      nonogramModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "nonogram");
        const board = el("div", "nonogram-board");
        const corner = el("div", "nonogram-corner", "5×5");
        board.appendChild(corner);
        model.colClues.forEach((clue) => board.appendChild(el("div", "nonogram-col-clue", clue.join(" "))));
        const state = Array(25).fill(0);
        const cells = [];
        const status = el("div", "nonogram-status muted", "Use the clues to uncover the small picture.");
        status.setAttribute("aria-live", "polite");
        const artUri = artwork && window.BloomArt ? window.BloomArt.dataUri(artwork.svg) : "";
        let done = false;

        function paint() {
          cells.forEach((cell, index) => {
            const row = Math.floor(index / size), col = index % size;
            cell.classList.toggle("is-filled", state[index] === 1);
            cell.classList.toggle("is-empty", state[index] === -1);
            cell.textContent = state[index] === -1 ? "×" : "";
            cell.setAttribute("aria-label", `row ${row + 1}, column ${col + 1}: ${state[index] === 1 ? "filled" : state[index] === -1 ? "marked empty" : "blank"}`);
            cell.setAttribute("aria-pressed", String(state[index] === 1));
            if (state[index] === 1 && artUri) {
              cell.style.backgroundImage = `linear-gradient(rgba(255,255,255,.28), rgba(255,255,255,.28)), url("${artUri}")`;
              cell.style.backgroundSize = "500% 500%";
              cell.style.backgroundPosition = `${col * 25}% ${row * 25}%`;
            } else cell.style.backgroundImage = "";
          });
        }
        function check() {
          if (state.every((value, index) => (value === 1) === (model.solution[index] === 1))) {
            done = true;
            wrap.classList.add("is-complete");
            status.textContent = "The little picture is complete.";
            onSolved();
          }
        }
        for (let row = 0; row < size; row += 1) {
          board.appendChild(el("div", "nonogram-row-clue", model.rowClues[row].join(" ")));
          for (let col = 0; col < size; col += 1) {
            const index = row * size + col;
            const cell = el("button", "nonogram-cell");
            cell.type = "button";
            cell.addEventListener("click", () => {
              if (done) return;
              state[index] = state[index] === 0 ? 1 : state[index] === 1 ? -1 : 0;
              status.textContent = state[index] === 1 ? "Square filled." : state[index] === -1 ? "Square marked empty." : "Square cleared.";
              paint();
              check();
            });
            cells.push(cell);
            board.appendChild(cell);
          }
        }
        wrap.appendChild(board);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          const index = state.findIndex((value, i) => (value === 1) !== (model.solution[i] === 1));
          if (index < 0) return;
          state[index] = model.solution[index] ? 1 : -1;
          cells[index].classList.add("is-hint");
          status.textContent = model.solution[index] ? "This square belongs to the picture." : "This square stays empty.";
          paint();
          check();
        };
      }
    };
  }

  const SHAPE_FIT_FORMS = ["triangle", "square", "circle", "diamond", "leaf", "hexagon", "kite", "oval"];
  const SHAPE_FIT_POSITIONS = [
    { x: 8, y: 10 }, { x: 38, y: 8 }, { x: 67, y: 12 },
    { x: 18, y: 48 }, { x: 50, y: 46 }, { x: 72, y: 54 }
  ];

  function validateShapeFit(model) {
    if (!model || !Array.isArray(model.pieces) || !Array.isArray(model.slots)) return false;
    if (model.pieces.length < 4 || model.pieces.length > 6 || model.slots.length !== model.pieces.length) return false;
    const pieceIds = model.pieces.map((piece) => piece.id);
    const slotIds = model.slots.map((slot) => slot.pieceId);
    if (new Set(pieceIds).size !== pieceIds.length || new Set(slotIds).size !== slotIds.length) return false;
    if (pieceIds.slice().sort().join(",") !== slotIds.slice().sort().join(",")) return false;
    return model.pieces.every((piece) => SHAPE_FIT_FORMS.includes(piece.shape) && PALETTE.includes(piece.color))
      && model.slots.every((slot) => Number.isFinite(slot.x) && Number.isFinite(slot.y) && slot.x >= 0 && slot.x <= 80 && slot.y >= 0 && slot.y <= 70);
  }

  function makeShapeFit(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const pieceCount = difficulty === "gentle" ? 4 : difficulty === "deep" ? 6 : 5;
    const forms = shuffle(rng, SHAPE_FIT_FORMS).slice(0, pieceCount);
    const colors = shuffle(rng, PALETTE.concat(PALETTE)).slice(0, pieceCount);
    const pieces = forms.map((shape, index) => ({ id: `piece-${index}`, shape, color: colors[index], rotation: int(rng, 4) * 45 }));
    const positions = shuffle(rng, SHAPE_FIT_POSITIONS).slice(0, pieceCount);
    const slots = shuffle(rng, pieces.map((piece, index) => ({ pieceId: piece.id, x: positions[index].x, y: positions[index].y })));
    const model = { difficulty, pieces: shuffle(rng, pieces), slots };
    if (!validateShapeFit(model)) throw new Error("Could not build a complete shape-fit board");

    return {
      type: "shapefit",
      title: "Gentle shape-fit",
      rules: "Choose a coloured piece, then choose its matching silhouette. You can also drag a piece into its generous shape area.",
      hints: [
        "Match the outer shape first; colour is there to help you keep track.",
        "You can hide or show the silhouettes whenever you like.",
        "A soft outline will show one piece and its home."
      ],
      shapeFitModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "shape-fit");
        const silhouetteButton = el("button", "shape-silhouette-toggle", "Hide silhouettes");
        const target = el("div", "shape-target");
        const tray = el("div", "shape-tray");
        const status = el("div", "shape-status muted", "Choose a piece, then its matching silhouette.");
        status.setAttribute("aria-live", "polite");
        const pieceById = new Map(model.pieces.map((piece) => [piece.id, piece]));
        const pieceButtons = new Map();
        const slotButtons = new Map();
        const placed = new Set();
        let selected = null;
        let silhouettesVisible = true;
        let done = false;

        function shapeSpan(piece, className) {
          const shape = el("span", `${className} shape-${piece.shape}`);
          shape.style.backgroundColor = piece.color;
          shape.style.transform = `rotate(${piece.rotation}deg)`;
          return shape;
        }
        function paint() {
          pieceButtons.forEach((button, id) => {
            button.classList.toggle("is-selected", selected === id);
            button.classList.toggle("is-placed", placed.has(id));
            button.disabled = placed.has(id);
          });
          slotButtons.forEach((button, id) => {
            button.classList.toggle("is-filled", placed.has(id));
            button.classList.toggle("silhouette-hidden", !silhouettesVisible && !placed.has(id));
          });
          silhouetteButton.textContent = silhouettesVisible ? "Hide silhouettes" : "Show silhouettes";
          silhouetteButton.setAttribute("aria-pressed", String(silhouettesVisible));
        }
        function choosePiece(id) {
          if (done || placed.has(id)) return;
          selected = selected === id ? null : id;
          status.textContent = selected ? "Now choose its silhouette." : "Piece returned to the tray.";
          paint();
        }
        function place(slotId) {
          if (done || !selected) {
            if (!done) status.textContent = "Choose a piece from the tray first.";
            return;
          }
          if (selected !== slotId) {
            status.textContent = "That shape has another home. Try a different silhouette.";
            return;
          }
          placed.add(slotId);
          selected = null;
          const slotButton = slotButtons.get(slotId);
          slotButton.innerHTML = "";
          slotButton.appendChild(shapeSpan(pieceById.get(slotId), "shape-piece-visual"));
          status.textContent = `Piece settled. ${pieceCount - placed.size} remain.`;
          if (placed.size === pieceCount) {
            done = true;
            wrap.classList.add("is-complete");
            status.textContent = "Every shape has found its place.";
            onSolved();
          }
          paint();
        }

        model.slots.forEach((slot) => {
          const piece = pieceById.get(slot.pieceId);
          const button = el("button", "shape-slot");
          button.type = "button";
          button.style.left = `${slot.x}%`;
          button.style.top = `${slot.y}%`;
          button.setAttribute("aria-label", `${piece.shape} silhouette`);
          button.appendChild(shapeSpan(piece, "shape-slot-visual"));
          button.addEventListener("click", () => place(slot.pieceId));
          button.addEventListener("dragover", (event) => event.preventDefault());
          button.addEventListener("drop", (event) => { event.preventDefault(); selected = event.dataTransfer.getData("text/plain"); place(slot.pieceId); });
          slotButtons.set(slot.pieceId, button);
          target.appendChild(button);
        });
        model.pieces.forEach((piece) => {
          const button = el("button", "shape-piece");
          button.type = "button";
          button.draggable = true;
          button.setAttribute("aria-label", `${piece.color} ${piece.shape} piece`);
          button.appendChild(shapeSpan(piece, "shape-piece-visual"));
          button.addEventListener("click", () => choosePiece(piece.id));
          button.addEventListener("dragstart", (event) => { selected = piece.id; event.dataTransfer.setData("text/plain", piece.id); paint(); });
          pieceButtons.set(piece.id, button);
          tray.appendChild(button);
        });
        silhouetteButton.type = "button";
        silhouetteButton.addEventListener("click", () => { silhouettesVisible = !silhouettesVisible; paint(); });
        wrap.appendChild(silhouetteButton);
        wrap.appendChild(target);
        wrap.appendChild(tray);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          const piece = model.pieces.find((candidate) => !placed.has(candidate.id));
          if (!piece) return;
          pieceButtons.forEach((button) => button.classList.remove("is-hint"));
          slotButtons.forEach((button) => button.classList.remove("is-hint"));
          pieceButtons.get(piece.id).classList.add("is-hint");
          slotButtons.get(piece.id).classList.add("is-hint");
          status.textContent = "The softly outlined piece fits the outlined home.";
        };
      }
    };
  }

  function validateFlow(model) {
    if (!model || model.size !== 5 || !Array.isArray(model.paths) || model.paths.length < 2 || model.paths.length > 4) return false;
    const occupied = new Set();
    for (const path of model.paths) {
      if (!Array.isArray(path.cells) || path.cells.length < 3 || typeof path.color !== "string") return false;
      for (let index = 0; index < path.cells.length; index += 1) {
        const cell = path.cells[index];
        if (!Number.isInteger(cell) || cell < 0 || cell >= 25 || occupied.has(cell)) return false;
        occupied.add(cell);
        if (index) {
          const previous = path.cells[index - 1];
          const distance = Math.abs(Math.floor(previous / 5) - Math.floor(cell / 5)) + Math.abs((previous % 5) - (cell % 5));
          if (distance !== 1) return false;
        }
      }
    }
    return true;
  }

  function makeFlow(rng, opts) {
    opts = opts || {};
    const difficulty = opts.difficulty || "standard";
    const pathCount = difficulty === "gentle" ? 2 : difficulty === "deep" ? 4 : 3;
    let model = null;
    const neighbors = (cell) => {
      const row = Math.floor(cell / 5), col = cell % 5;
      return [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]]
        .filter(([r, c]) => r >= 0 && r < 5 && c >= 0 && c < 5)
        .map(([r, c]) => r * 5 + c);
    };
    for (let boardTry = 0; boardTry < 120 && !model; boardTry += 1) {
      const used = new Set();
      const paths = [];
      let failed = false;
      for (let pathIndex = 0; pathIndex < pathCount; pathIndex += 1) {
        const available = shuffle(rng, Array.from({ length: 25 }, (_, i) => i).filter((cell) => !used.has(cell)));
        let cells = null;
        for (const start of available) {
          const candidate = [start];
          const local = new Set([start]);
          const wanted = 3 + int(rng, difficulty === "deep" ? 3 : 2);
          while (candidate.length < wanted) {
            const options = shuffle(rng, neighbors(candidate[candidate.length - 1]).filter((cell) => !used.has(cell) && !local.has(cell)));
            if (!options.length) break;
            candidate.push(options[0]);
            local.add(options[0]);
          }
          if (candidate.length === wanted) { cells = candidate; break; }
        }
        if (!cells) { failed = true; break; }
        cells.forEach((cell) => used.add(cell));
        paths.push({ id: `path-${pathIndex}`, color: PALETTE[pathIndex], cells });
      }
      const candidate = { size: 5, difficulty, paths };
      if (!failed && validateFlow(candidate)) model = candidate;
    }
    if (!model) throw new Error("Could not build calm connecting paths");

    return {
      type: "flow",
      title: "Quiet connections",
      rules: "Choose a coloured starting dot, then trace its calm route one neighbouring square at a time until it meets the matching ring.",
      hints: [
        "A route moves only up, down, left, or right.",
        "A soft outline can show the next square on the selected route.",
        "You can choose another starting dot whenever you like."
      ],
      flowModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "flow");
        const grid = el("div", "flow-grid");
        const status = el("div", "flow-status muted", "Choose any filled starting dot.");
        status.setAttribute("aria-live", "polite");
        const buttons = [];
        const progress = new Map(model.paths.map((path) => [path.id, 1]));
        let active = null;
        let done = false;

        function pathAtStart(cell) { return model.paths.find((path) => path.cells[0] === cell); }
        function pathAtEnd(cell) { return model.paths.find((path) => path.cells[path.cells.length - 1] === cell); }
        function paintedPath(cell) {
          return model.paths.find((path) => path.cells.slice(0, progress.get(path.id)).includes(cell));
        }
        function paint() {
          buttons.forEach((button, cell) => {
            const start = pathAtStart(cell), end = pathAtEnd(cell), painted = paintedPath(cell);
            button.className = "flow-cell";
            button.innerHTML = "";
            button.style.removeProperty("--flow-color");
            if (painted) {
              button.classList.add("is-path");
              button.style.setProperty("--flow-color", painted.color);
            }
            if (start) {
              button.classList.add("is-start");
              button.style.setProperty("--flow-color", start.color);
              button.setAttribute("aria-label", `start of ${start.id}`);
            } else if (end) {
              button.classList.add("is-end");
              button.style.setProperty("--flow-color", end.color);
              button.setAttribute("aria-label", `end of ${end.id}`);
            } else button.setAttribute("aria-label", `connection square ${cell + 1}`);
            if (active && active.cells[progress.get(active.id)] === cell) button.classList.add("is-next");
          });
        }
        function choose(cell) {
          if (done) return;
          const start = pathAtStart(cell);
          if (start && progress.get(start.id) < start.cells.length) {
            active = start;
            status.textContent = "Trace from this dot toward its matching ring.";
            paint();
            return;
          }
          if (!active) { status.textContent = "Choose a filled starting dot first."; return; }
          const nextIndex = progress.get(active.id);
          if (active.cells[nextIndex] !== cell) {
            status.textContent = "That square belongs elsewhere. Try a neighbouring square.";
            return;
          }
          progress.set(active.id, nextIndex + 1);
          if (nextIndex + 1 === active.cells.length) {
            status.textContent = "Connection complete.";
            active = null;
            if (model.paths.every((path) => progress.get(path.id) === path.cells.length)) {
              done = true;
              wrap.classList.add("is-complete");
              status.textContent = "Every quiet connection is complete.";
              onSolved();
            }
          } else status.textContent = "Keep following neighbouring squares.";
          paint();
        }
        for (let cell = 0; cell < 25; cell += 1) {
          const button = el("button", "flow-cell");
          button.type = "button";
          button.addEventListener("click", () => choose(cell));
          buttons.push(button);
          grid.appendChild(button);
        }
        wrap.appendChild(grid);
        wrap.appendChild(status);
        root.appendChild(wrap);
        paint();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          if (!active) active = model.paths.find((path) => progress.get(path.id) < path.cells.length);
          paint();
          status.textContent = "The softly outlined square continues this route.";
        };
      }
    };
  }

  // ===== Odd one out (gentle rule-discovery) ==============================
  function makeOddOneOut(rng) {
    const shapes = ["circle", "square", "triangle"];
    const dim = pick(rng, ["color", "shape", "count"]);
    const base = { shape: pick(rng, shapes), color: pick(rng, PALETTE), count: 3, rot: 0, size: 1 };
    const odd = Object.assign({}, base);
    if (dim === "color") {
      odd.color = pick(rng, PALETTE.filter((c) => c !== base.color));
    } else if (dim === "shape") {
      odd.shape = pick(rng, shapes.filter((s) => s !== base.shape));
    } else {
      base.shape = "dots"; odd.shape = "dots";
      odd.count = base.count + (rng() > 0.5 ? 1 : -1);
      if (odd.count < 1) odd.count = base.count + 2;
    }
    const total = 6;
    const oddIndex = int(rng, total);

    const hints = [
      "Five tiles match and one is different. Compare their colours, shapes, then counts.",
      dim === "color" ? "Look at the colours." : dim === "shape" ? "Look at the shapes." : "Count the dots in each one.",
      "Tap the one that doesn't belong — there's no penalty for trying."
    ];

    return {
      type: "odd",
      title: "Which doesn't belong?",
      rules: "Five of these are the same and one is different. Tap the odd one out.",
      hints,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const grid = el("div", "odd-grid");
        let done = false;
        for (let i = 0; i < total; i += 1) {
          const g = i === oddIndex ? odd : base;
          const b = el("button", "odd-tile");
          b.type = "button";
          b.innerHTML = glyphSvg(g);
          b.setAttribute("aria-label", `picture tile ${i + 1}`);
          b.addEventListener("click", () => {
            if (done) return;
            if (i === oddIndex) { done = true; b.classList.add("is-correct"); onSolved(); }
            else { b.classList.add("is-wrong"); b.addEventListener("animationend", () => b.classList.remove("is-wrong"), { once: true }); }
          });
          grid.appendChild(b);
        }
        root.appendChild(grid);
      }
    };
  }

  // ===== Complete the symmetry (visuospatial, art-linked) =================
  function makeSymmetry(rng) {
    const W = 6, H = 5, half = W / 2;
    const left = [];
    for (let r = 0; r < H; r += 1) { left[r] = []; for (let c = 0; c < half; c += 1) left[r][c] = rng() < 0.5; }
    // Make sure there's a real pattern (not nearly empty/full).
    let filled = 0; for (let r = 0; r < H; r += 1) for (let c = 0; c < half; c += 1) if (left[r][c]) filled += 1;
    while (filled < 4) { const r = int(rng, H), c = int(rng, half); if (!left[r][c]) { left[r][c] = true; filled += 1; } }
    const color = pick(rng, PALETTE);
    const right = {};

    const hints = [
      "Fill the right side so the whole picture is a mirror of the left.",
      "Work row by row — copy each left square to the matching spot on the right.",
      "Tap a square to fill it; tap again to clear it."
    ];
    const targetFor = (r, c) => left[r][W - 1 - c];

    return {
      type: "symmetry",
      title: "Complete the mirror",
      rules: "The left side shows half a pattern. Fill the right side so the picture is symmetrical.",
      hints,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const grid = el("div", "sym-grid");
        grid.style.gridTemplateColumns = `repeat(${W}, 1fr)`;
        const cells = [];
        let done = false;

        function isFilled(r, c) { return c < half ? left[r][c] : !!right[r + "-" + c]; }
        function paint() {
          for (let r = 0; r < H; r += 1) for (let c = 0; c < W; c += 1) {
            const cell = cells[r * W + c];
            cell.style.background = isFilled(r, c) ? color : "var(--surface)";
            cell.classList.toggle("given", c < half);
            cell.classList.toggle("axis", c === half);
          }
        }
        function check() {
          for (let r = 0; r < H; r += 1) for (let c = half; c < W; c += 1) {
            if (!!right[r + "-" + c] !== targetFor(r, c)) return;
          }
          done = true; grid.classList.add("is-complete"); onSolved();
        }
        for (let r = 0; r < H; r += 1) for (let c = 0; c < W; c += 1) {
          const cell = el("button", "sym-cell");
          cell.type = "button";
          cell.setAttribute("aria-label", `${c < half ? "given" : "editable"} mirror square, row ${r + 1}, column ${c + 1}`);
          if (c < half) cell.disabled = true;
          else cell.addEventListener("click", () => {
            if (done) return;
            const k = r + "-" + c;
            if (right[k]) delete right[k]; else right[k] = true;
            paint(); check();
          });
          cells.push(cell); grid.appendChild(cell);
        }
        root.appendChild(grid);
        paint();

        root._applyHint = (level) => {
          if (done || level < 2) return;
          for (let r = 0; r < H; r += 1) for (let c = half; c < W; c += 1) {
            const want = targetFor(r, c);
            if (!!right[r + "-" + c] !== want) {
              if (want) right[r + "-" + c] = true; else delete right[r + "-" + c];
              paint(); check(); return;
            }
          }
        };
      }
    };
  }

  // ===== Visible-state matching ===========================================
  function validateMatching(model) {
    if (!model || !Array.isArray(model.tiles) || model.tiles.length < 8 || model.tiles.length % 2 !== 0) return false;
    const counts = {};
    for (const tile of model.tiles) {
      if (!tile || typeof tile.pair !== "string" || typeof tile.glyph !== "string") return false;
      counts[tile.pair] = (counts[tile.pair] || 0) + 1;
    }
    const pairs = Object.keys(counts);
    return pairs.length === model.tiles.length / 2 && pairs.every((pair) => counts[pair] === 2);
  }

  function makeMatching(rng, opts) {
    opts = opts || {};
    const pairCount = opts.difficulty === "gentle" ? 6 : opts.difficulty === "deep" ? 10 : 8;
    const glyphs = shuffle(rng, MATCH_GLYPHS).slice(0, pairCount);
    const tiles = [];
    glyphs.forEach((glyph, pairIndex) => {
      const pair = "pair-" + pairIndex;
      tiles.push({ id: pair + "-a", pair, glyph });
      tiles.push({ id: pair + "-b", pair, glyph });
    });
    const model = { pairCount, tiles: shuffle(rng, tiles) };
    if (!validateMatching(model)) throw new Error("Could not build a clearable matching board");

    return {
      type: "matching",
      title: "Match the art tiles",
      rules: "All the tiles stay visible. Tap two that match to gently clear the pair.",
      hints: [
        "Scan one row at a time and look for the same picture twice.",
        "A soft outline will show one pair you can choose.",
        "You can shuffle the remaining tiles whenever a fresh view would help."
      ],
      matchingModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "match");
        const grid = el("div", "match-grid");
        const status = el("div", "match-status muted", "Choose any tile to begin.");
        status.setAttribute("aria-live", "polite");
        const shuffleBtn = el("button", "match-shuffle", "Shuffle remaining");
        shuffleBtn.type = "button";
        const tileEls = new Map();
        const cleared = new Set();
        let order = model.tiles.map((tile) => tile.id);
        let selected = null;
        let done = false;

        function tileById(id) { return model.tiles.find((tile) => tile.id === id); }
        function paintOrder() {
          order.forEach((id) => {
            const button = tileEls.get(id);
            if (button) grid.appendChild(button);
          });
        }
        function clearHints() { tileEls.forEach((button) => button.classList.remove("is-hint")); }
        function choose(tile) {
          if (done || cleared.has(tile.id)) return;
          clearHints();
          if (!selected) {
            selected = tile;
            tileEls.get(tile.id).classList.add("is-selected");
            status.textContent = "Now choose its match.";
            return;
          }
          tileEls.get(selected.id).classList.remove("is-selected");
          if (selected.id !== tile.id && selected.pair === tile.pair) {
            cleared.add(selected.id);
            cleared.add(tile.id);
            tileEls.get(selected.id).classList.add("is-cleared");
            tileEls.get(tile.id).classList.add("is-cleared");
            tileEls.get(selected.id).disabled = true;
            tileEls.get(tile.id).disabled = true;
            status.textContent = "A pair found - lovely.";
          } else {
            status.textContent = selected.id === tile.id ? "Choose a second tile." : "Those are different - try another pair.";
          }
          selected = null;
          if (cleared.size === model.tiles.length) {
            done = true;
            wrap.classList.add("is-complete");
            shuffleBtn.disabled = true;
            status.textContent = "Every pair is together.";
            onSolved();
          }
        }

        model.tiles.forEach((tile) => {
          const button = el("button", "match-tile", tile.glyph);
          button.type = "button";
          button.setAttribute("aria-label", "art tile " + tile.glyph);
          button.addEventListener("click", () => choose(tile));
          tileEls.set(tile.id, button);
          grid.appendChild(button);
        });
        shuffleBtn.addEventListener("click", () => {
          if (done) return;
          const remaining = order.filter((id) => !cleared.has(id));
          const finished = order.filter((id) => cleared.has(id));
          order = shuffle(rng, remaining).concat(finished);
          selected = null;
          clearHints();
          tileEls.forEach((button) => button.classList.remove("is-selected"));
          paintOrder();
          status.textContent = "A fresh arrangement, with every pair still here.";
        });

        wrap.appendChild(grid);
        wrap.appendChild(shuffleBtn);
        wrap.appendChild(status);
        root.appendChild(wrap);

        root._applyHint = (level) => {
          if (done || level < 2) return;
          clearHints();
          const available = model.tiles.find((tile) => !cleared.has(tile.id));
          if (!available) return;
          model.tiles.filter((tile) => tile.pair === available.pair).forEach((tile) => tileEls.get(tile.id).classList.add("is-hint"));
          status.textContent = "The softly outlined tiles make a pair.";
        };
      }
    };
  }

  // ===== Word search (art-themed scanning) =================================
  function wordRun(grid, row, col, dr, dc, length) {
    const run = [];
    for (let i = 0; i < length; i += 1) {
      const r = row + dr * i, c = col + dc * i;
      if (r < 0 || c < 0 || r >= grid.length || c >= grid.length) return null;
      run.push({ row: r, col: c });
    }
    return run;
  }

  function findWordRuns(grid, word) {
    const found = [];
    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid.length; col += 1) {
        for (const [dr, dc] of WORD_SEARCH_DIRECTIONS) {
          const run = wordRun(grid, row, col, dr, dc, word.length);
          if (run && run.map((p) => grid[p.row][p.col]).join("") === word) found.push(run);
        }
      }
    }
    return found;
  }

  function validateWordSearch(model) {
    if (!model || !Array.isArray(model.grid) || !Array.isArray(model.words) || !Array.isArray(model.placements)) return false;
    const size = model.grid.length;
    if (size < 6 || size > 7 || model.grid.some((row) => !Array.isArray(row) || row.length !== size)) return false;
    if (new Set(model.words).size !== model.words.length || model.words.length !== model.placements.length) return false;
    for (const word of model.words) {
      const placement = model.placements.find((p) => p.word === word);
      if (!placement || placement.cells.length !== word.length) return false;
      if (placement.cells.map((p) => model.grid[p.row] && model.grid[p.row][p.col]).join("") !== word) return false;
      // Exactly one findable run keeps the generated puzzle unambiguous.
      if (findWordRuns(model.grid, word).length !== 1) return false;
    }
    return true;
  }

  function buildWordSearch(rng, theme, difficulty) {
    const bank = WORD_SEARCH_THEMES[theme] || WORD_SEARCH_THEMES.botanical;
    for (let boardTry = 0; boardTry < 80; boardTry += 1) {
      const size = difficulty === "gentle" ? 6 : difficulty === "deep" ? 7 : (rng() < 0.5 ? 6 : 7);
      const wordCount = difficulty === "gentle" ? 4 : difficulty === "deep" ? 5 : (size === 6 ? 4 : (rng() < 0.5 ? 4 : 5));
      const words = shuffle(rng, bank.filter((word) => word.length <= size)).slice(0, wordCount);
      const grid = Array.from({ length: size }, () => new Array(size).fill(""));
      const placements = [];
      const directions = difficulty === "gentle" || size === 6
        ? [[0, 1], [1, 0], [0, -1], [-1, 0]]
        : WORD_SEARCH_DIRECTIONS;

      for (const word of words) {
        let placed = null;
        for (let placeTry = 0; placeTry < 180 && !placed; placeTry += 1) {
          const [dr, dc] = pick(rng, directions);
          const run = wordRun(grid, int(rng, size), int(rng, size), dr, dc, word.length);
          if (!run) continue;
          if (run.some((p, i) => grid[p.row][p.col] && grid[p.row][p.col] !== word[i])) continue;
          run.forEach((p, i) => { grid[p.row][p.col] = word[i]; });
          placed = { word, cells: run };
        }
        if (!placed) break;
        placements.push(placed);
      }
      if (placements.length !== words.length) continue;

      const filler = (bank.join("") + "AEILNORSTU").split("");
      for (let row = 0; row < size; row += 1) {
        for (let col = 0; col < size; col += 1) {
          if (!grid[row][col]) grid[row][col] = pick(rng, filler);
        }
      }
      const model = { theme, difficulty, size, grid, words, placements };
      if (validateWordSearch(model)) return model;
    }
    throw new Error("Could not build a valid word search");
  }

  function makeWordSearch(rng, opts) {
    opts = opts || {};
    const seasonalTheme = ["garden", "nature"].includes(opts.wordTheme) ? "botanical"
      : opts.wordTheme === "art" ? "fineart"
        : ["kitchen", "weather"].includes(opts.wordTheme) ? "cozy" : null;
    const theme = seasonalTheme || opts.theme || (opts.artwork && opts.artwork.theme) || "botanical";
    const difficulty = opts.difficulty || "standard";
    const model = buildWordSearch(rng, theme, difficulty);
    const themeName = theme === "fineart" ? "art" : theme === "cozy" ? "quiet moments" : "the garden";

    return {
      type: "wordsearch",
      title: "Find the hidden words",
      rules: `Find the words from ${themeName}. Tap the first and last letter, or drag along the word.`,
      hints: [
        "Words run in a straight line. They may read forwards or backwards.",
        "Try the first letter of an unfound word, then look across and down.",
        "A gentle highlight will show one word's path."
      ],
      wordSearchModel: model,
      render(root, { onSolved }) {
        root.innerHTML = "";
        const wrap = el("div", "ws");
        const wordList = el("div", "ws-words");
        const status = el("div", "ws-status muted", "Choose a word to begin.");
        status.setAttribute("aria-live", "polite");
        const grid = el("div", "ws-grid");
        grid.style.setProperty("--ws-size", model.size);
        grid.setAttribute("role", "group");
        grid.setAttribute("aria-label", `${model.size} by ${model.size} word search`);
        const cells = [];
        const foundWords = new Set();
        const foundCells = new Set();
        let selected = [];
        let tapStart = null;
        let dragStart = null;
        let dragEnd = null;
        let dragged = false;
        let suppressClick = false;
        let done = false;

        model.words.forEach((word) => {
          const item = el("span", "ws-word", word);
          item.dataset.word = word;
          wordList.appendChild(item);
        });

        function keyFor(p) { return p.row + "-" + p.col; }
        function lineBetween(a, b) {
          const rd = b.row - a.row, cd = b.col - a.col;
          if (rd !== 0 && cd !== 0 && Math.abs(rd) !== Math.abs(cd)) return null;
          if (rd === 0 && cd === 0) return [a];
          const length = Math.max(Math.abs(rd), Math.abs(cd)) + 1;
          return wordRun(model.grid, a.row, a.col, Math.sign(rd), Math.sign(cd), length);
        }
        function paint() {
          const selectedKeys = new Set(selected.map(keyFor));
          cells.forEach((cell) => {
            const k = cell.dataset.row + "-" + cell.dataset.col;
            cell.classList.toggle("is-selected", selectedKeys.has(k));
            cell.classList.toggle("is-found", foundCells.has(k));
            cell.setAttribute("aria-pressed", foundCells.has(k) ? "true" : "false");
          });
        }
        function clearHints() { cells.forEach((cell) => cell.classList.remove("is-hint")); }
        function tryRun(run) {
          if (!run || run.length < 2) {
            status.textContent = "Choose a straight line of letters.";
            selected = [];
            paint();
            return;
          }
          selected = run;
          const letters = run.map((p) => model.grid[p.row][p.col]).join("");
          const reverse = letters.split("").reverse().join("");
          const word = model.words.find((candidate) => !foundWords.has(candidate) && (candidate === letters || candidate === reverse));
          if (!word) {
            status.textContent = "Not one of these words - try another line.";
            paint();
            return;
          }
          foundWords.add(word);
          run.forEach((p) => foundCells.add(keyFor(p)));
          const label = wordList.querySelector(`[data-word="${word}"]`);
          if (label) label.classList.add("is-found");
          status.textContent = `${word} found - lovely.`;
          clearHints();
          paint();
          if (foundWords.size === model.words.length) {
            done = true;
            wrap.classList.add("is-complete");
            status.textContent = "Every word found. Lovely work.";
            onSolved();
          }
        }
        function tapCell(point) {
          if (done) return;
          clearHints();
          if (!tapStart) {
            tapStart = point;
            selected = [point];
            status.textContent = "Now choose the last letter.";
            paint();
            return;
          }
          const run = lineBetween(tapStart, point);
          tapStart = null;
          tryRun(run);
        }
        function pointFromEvent(event) {
          const hit = document.elementFromPoint(event.clientX, event.clientY);
          const cell = hit && hit.closest ? hit.closest(".ws-cell") : null;
          if (!cell || !grid.contains(cell)) return null;
          return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
        }
        function stopDrag() {
          window.removeEventListener("pointermove", moveDrag);
          window.removeEventListener("pointerup", endDrag);
          window.removeEventListener("pointercancel", cancelDrag);
        }
        function moveDrag(event) {
          if (!dragStart || done) return;
          const point = pointFromEvent(event);
          if (!point || (point.row === dragEnd.row && point.col === dragEnd.col)) return;
          const run = lineBetween(dragStart, point);
          if (!run) return;
          dragged = true;
          dragEnd = point;
          selected = run;
          paint();
        }
        function endDrag() {
          stopDrag();
          if (dragged) {
            suppressClick = true;
            tapStart = null;
            tryRun(lineBetween(dragStart, dragEnd));
            Promise.resolve().then(() => { suppressClick = false; });
          }
          dragStart = null;
        }
        function cancelDrag() { stopDrag(); dragStart = null; selected = []; paint(); }

        for (let row = 0; row < model.size; row += 1) {
          for (let col = 0; col < model.size; col += 1) {
            const cell = el("button", "ws-cell", model.grid[row][col]);
            cell.type = "button";
            cell.dataset.row = row;
            cell.dataset.col = col;
            cell.setAttribute("aria-label", `row ${row + 1}, column ${col + 1}, ${model.grid[row][col]}`);
            cell.addEventListener("pointerdown", () => {
              if (done) return;
              dragStart = { row, col };
              dragEnd = dragStart;
              dragged = false;
              selected = [dragStart];
              paint();
              window.addEventListener("pointermove", moveDrag);
              window.addEventListener("pointerup", endDrag);
              window.addEventListener("pointercancel", cancelDrag);
            });
            cell.addEventListener("click", () => {
              if (suppressClick) return;
              tapCell({ row, col });
            });
            cells.push(cell);
            grid.appendChild(cell);
          }
        }

        wrap.appendChild(wordList);
        wrap.appendChild(grid);
        wrap.appendChild(status);
        root.appendChild(wrap);

        root._applyHint = (level) => {
          if (done || level < 2) return;
          clearHints();
          const next = model.placements.find((p) => !foundWords.has(p.word));
          if (!next) return;
          const shown = level >= 3 ? next.cells : [next.cells[0]];
          shown.forEach((p) => cells[p.row * model.size + p.col].classList.add("is-hint"));
          status.textContent = level >= 3 ? `Follow the highlighted path for ${next.word}.` : `${next.word} begins at the highlighted letter.`;
        };
      }
    };
  }

  window.BloomPuzzles = {
    palette: PALETTE,
    makePattern,
    makeAssembly,
    makeLogic,
    makeWord,
    makeAnagram,
    validateAnagram,
    makeWordChain,
    validateWordChain,
    makeCrosswordLite,
    validateCrosswordLite,
    makeSudoku,
    validateSudoku,
    countSudokuSolutions,
    makeSpotDifference,
    validateSpotDifference,
    makeMemory,
    validateMemory,
    makeNonogram,
    validateNonogram,
    countNonogramSolutions,
    makeShapeFit,
    validateShapeFit,
    makeFlow,
    validateFlow,
    makeOddOneOut,
    makeSymmetry,
    makeMatching,
    validateMatching,
    makeWordSearch,
    validateWordSearch
  };
})();
