# EcoPrompt V2 Implementation Plan

## Goal
Upgrade EcoPrompt to Version 2.0 with accurate emission calculations, robust ChatGPT/Claude/Gemini detection, self-contained offline assets, clean React popup code, and verified build, preserving Version 1 untouched on `main`.

## Tasks
- [x] Task 1: Fix emission calculation formulas & battery equivalence in `utils/calculator.js`, and bump `manifest.json` to v2.0.0 → Verify: Unit tests/checks confirm 1 Wh = 1.8 mL water and 1 smartphone = 12 Wh.
- [x] Task 2: Overhaul `content/chatgpt.js` with modern ChatGPT selectors, reliable streaming detection (stop button + text debounce + typing indicator), and text badge isolation → Verify: Badges render cleanly without counting their own text, and streaming captures final response accurately.
- [x] Task 3: Upgrade `content/claude.js` and `content/gemini.js` to prevent historical chat flooding and badge text recursion → Verify: Only current session completed responses are logged to storage.
- [x] Task 4: Remove dead files (`utils/tokenizer.js`, `popup/index.html`, unused Vite boilerplate in `popup-src/src/App.css`) and clean root configuration → Verify: Unused files eliminated without breaking build.
- [x] Task 5: Replace external network requests (Wikimedia Earth image and Google Fonts) with local self-contained assets in `popup-src` → Verify: Popup renders offline with no CSP or external HTTP requests.
- [x] Task 6: Resolve React 19 purity warnings, calendar-day chart bucketing, and ESLint `chrome` global issues in `popup-src` → Verify: `npm run lint` passes with 0 errors.
- [x] Task 7: Build production popup bundle (`npm run build`) and update root build scripts → Verify: `popup-src/dist/` is cleanly generated and referenced by `manifest.json`.
- [x] Task 8: Verification & Commit Staging: Verify all scripts, package integrity, and stage commits with clear milestones → Verify: Clean working tree on `v2` branch ready for review.

## Done When
- [x] ChatGPT, Claude, and Gemini scripts accurately track and badge responses without text loops or premature saves.
- [x] Emission metrics (water, energy, CO₂, smartphone charge) are mathematically accurate based on Li et al. 2023 and Patterson et al. 2021.
- [x] Popup builds with 0 lint errors, loads completely offline, and includes clear history functionality.
- [x] Version 1 is preserved intact on `main`; Version 2 is completely organized on `v2`.
