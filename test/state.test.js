"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { sanitizeUserState } = require("../server-auth");

test("legacy progress and archive state stays intact", () => {
  const state = sanitizeUserState({
    progress: { "2026-06-20": 2 },
    archive: {
      "2026-06-19": { date: "2026-06-19", artId: "rose", title: "Rose", theme: "botanical" }
    }
  });

  assert.equal(state.progress["2026-06-20"], 2);
  assert.equal(state.archive["2026-06-19"].title, "Rose");
  assert.deepEqual(state.library, { counters: {}, effort: {} });
  assert.equal(state.depth, "standard");
});

test("favourites sync as a bounded, date-keyed set", () => {
  const state = sanitizeUserState({
    favorites: { "2026-06-21": 1, "2026-06-22": true, "not-a-date": 1, "2026-06-23": 0 }
  });
  assert.deepEqual(state.favorites, { "2026-06-21": 1, "2026-06-22": 1 });
  assert.deepEqual(sanitizeUserState({}).favorites, {});
});

test("library counters are additive, bounded account state", () => {
  const state = sanitizeUserState({
    library: {
      counters: {
        wordsearch: 12.9,
        pattern: 4,
        unknown: 99,
        logic: -1,
        assembly: 1000001
      }
    }
  });

  assert.deepEqual(state.library.counters, { wordsearch: 12, pattern: 4 });
});

test("depth preference is allowlisted", () => {
  assert.equal(sanitizeUserState({ depth: "deep" }).depth, "deep");
  assert.equal(sanitizeUserState({ depth: "extreme" }).depth, "standard");
});

test("effort records are cumulative and bounded", () => {
  const state = sanitizeUserState({ library: { effort: { explorer: 9.8, wordGardener: 3, unknown: 99, logicTender: -1 } } });
  assert.deepEqual(state.library.effort, { explorer: 9, wordGardener: 3 });
});

test("sensory preferences are boolean-only and safely defaulted", () => {
  // Soft sound + gentle haptic default ON; calm palette stays on.
  assert.deepEqual(sanitizeUserState({}).sensory, { calmPalette: true, sound: true, haptics: true });
  // Provided booleans win; invalid types fall back to the default; unknown keys drop.
  assert.deepEqual(
    sanitizeUserState({ sensory: { calmPalette: false, sound: true, haptics: "yes", extra: true } }).sensory,
    { calmPalette: false, sound: true, haptics: true }
  );
  // Display prefs (dark/reduceMotion/contrast/largeText) sync only once explicitly set,
  // so a fresh account still honours the device's OS preferences.
  assert.deepEqual(
    sanitizeUserState({ sensory: { dark: true, largeText: true, bogus: true } }).sensory,
    { calmPalette: true, sound: true, haptics: true, dark: true, largeText: true }
  );
});
