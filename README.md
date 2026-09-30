# Bloom 🌸

A gentle, calm **daily puzzle** Progressive Web App. Each day gives you one short,
low-pressure set of puzzles and a soft art reveal at the end.

I wanted the opposite of what the mainstream puzzle apps do. Nothing to keep up, no pressure
language, and nothing that guilts you into coming back. It is built to a calm-interface
standard throughout: forgiving, predictable, and quiet.

## What it does

- **A short daily set**, generated deterministically from the date. Fresh every day, and the
  same for everyone that day.
- **17 puzzle types**, all generated in the browser: word search, mini-sudoku, picross,
  letter-bank anagrams, word ladders, crossword-lite, spot-the-difference, art memory pairs,
  art tile matching, shape-fit, connections, patterns, logic grids, picture pieces,
  odd-one-out, mirror patterns and word play.
- **Procedural art of the day.** A fresh, calm scene each day, with more than three months of
  variety before anything repeats. Finishing a day reveals it into a private gallery.
- **Per-account galleries and progress**, stored server-side and synced across a user's
  devices. Each person's gallery is their own.
- **Invite-only access.** Google sign-in is verified server-side against an email allowlist,
  and it trusts Cloudflare Access for single sign-on.
- **Accessible by default:** reduced-motion, dark mode, high contrast, larger text, big touch
  targets, and offline-first so it can be added to the home screen on iOS and iPadOS.

## The generators are tested, not assumed

The logic-grid clues are brute-force-checked to have exactly one solution, so a puzzle is
never ambiguous. The main puzzle families are run against 2,100 seeds each to confirm every
one stays solvable and does not repeat itself.

There is also a test that **fails the build** if any urgency mechanic or pressure wording
ever reaches a release. That one exists because the calm part is the whole point, and I did
not want to rely on remembering it.

## Tech

Node and Express for static serving and a small invite-only auth layer, with a vanilla-JS PWA
front end and **no build step**. Storage is small JSON files. It runs in a hardened Docker
container (non-root, read-only filesystem) behind a Cloudflare Tunnel, so there are no inbound
ports.

## Run locally

```bash
npm install
npm start          # http://localhost:4000
npm test           # node --test
```

Accounts stay dormant and the app runs open until `GOOGLE_CLIENT_ID` is set, so local
development needs no setup.

## Documentation

- **`PLAN.md`** — architecture, the design evidence, the deploy and backup runbook, the
  account and invite model, and the roadmap.
- **`RESEARCH-evidence-based-design-report.pdf`** — the published research on calm,
  low-pressure interface design that the rules above were drawn from. It is a design
  reference, not a medical claim.

## Privacy

Runs privately, invite-only, on my own server. Puzzles and artwork are generated on-device.
Account data (gallery and progress) lives only on that server and is backed up to separate
disks. No third-party analytics and no trackers.
