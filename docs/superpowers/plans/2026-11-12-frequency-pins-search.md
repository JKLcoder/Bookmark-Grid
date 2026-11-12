# Frequency, Pins and Dual Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for inline execution or superpowers:subagent-driven-development if the user selects delegated execution. Steps use checkbox syntax for tracking.

**Goal:** Rank bookmarks by local usage with pins, and add a shared search input defaulting to the Chrome search engine.

**Architecture:** A background-owned queue serializes usage and pin mutations. React keeps a frequency snapshot for the lifetime of the page, applies live pin state, and delegates actual engine searches to Chrome.

**Tech Stack:** Existing React/TypeScript/Vite, Chrome MV3, Vitest/Testing Library, Playwright and bundled Radix icons; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-12-frequency-pins-search-design.md` — approved by the user on 2026-11-12.

## Global Constraints

- Work in the existing isolated `/workspace/Bookmark-Grid` checkout; no new worktree.
- Retain Chrome 93+, existing bookmark API source, alias/layout keys, favicons, shared sizing and native anchors.
- Permissions are `bookmarks`, `storage`, `favicon`, `search`; no `history`, `tabs` or host permissions.
- Persist only local per-bookmark usage/pin metadata; do not copy bookmark trees or send metadata to external services.
- Default to engine mode on every page load. Only explicit engine submission sends text to the browser's default provider.
- Pins update immediately; frequency changes affect ordering on next page load, not immediately after a click.
- Do not modify original bookmarks. Ship an updated README and build ZIP; no Chrome Web Store submission.

## Review Focus

- Concurrent record/pin/deletion operations must not lose counts, pin state or recreate deleted entries.
- Left, keyboard, modifier and middle activation must record once without blocking native navigation; right-click and utility buttons must not record.
- A background failure or malformed persisted value must not break opening bookmarks or poison sorting.
- Chinese IME confirmation, blank submits and switching modes with a query must never accidentally submit web searches.
- Storage refresh must update pins without applying changed click totals to the current page's frequency snapshot.

---

### Task 1: Local usage store and cleanup

**Files:** Create `public/usage-store.js`, `src/usage.ts`, `tests/usage-store.test.ts`; modify `public/background.js`, `tests/background.test.ts`.

**Interfaces:**
- `Usage = { count: number; lastOpened: number; pinned: boolean }`; `UsageMap = Record<string, Usage>` in `src/usage.ts`.
- Store keys: `usage:<bookmarkId>` containing the above object; missing fields normalize to zero/false.
- `createUsageStore(api)` in `public/usage-store.js` exposes `load()`, `record(id)`, `setPinned(id,pinned)` and `remove(ids)`, all Promise-based and serialized through one worker-owned queue.
- Background message union: `{type:'usage:load'}`, `{type:'usage:record',id}`, `{type:'usage:pin',id,pinned}`. Response union: `{ok:true,data}` or `{ok:false,error}`.
- Frontend exports `loadUsage():Promise<UsageMap>`, `recordOpen(id:string):Promise<void>`, `setPinned(id:string,pinned:boolean):Promise<void>`; explicit background failures reject.

- [ ] Write store tests: simultaneous 50 opens produce `count === 50`; pin writes preserve count/time; deletion clears `name:` and `usage:` for an entire subtree; queued opens for a deleted ID do not recreate it. Use a real in-memory storage adapter and bookmark fixture, not mocks of the store itself.
- [ ] Add malformed-data/read-failure tests: negative/nonfinite counts normalize, missing records default, storage errors reject, and a rejected operation does not permanently poison the queue.
- [ ] Run `npm test -- tests/usage-store.test.ts tests/background.test.ts`; observe failures before implementation.
- [ ] Implement the store and synchronous background event registration. Use callback `sendResponse` plus `return true` to keep async messaging alive on Chrome 93. Validate message types/IDs and existence of URL bookmark nodes before mutating records. Route removal and page-load orphan cleanup through the same queue.
- [ ] Test callback lifetime, response errors and queue completion; run the targeted tests and full `npm test`; commit the tested store/API work.

### Task 2: Ranking and bookmark activation

**Files:** Create `src/ranking.ts`, `tests/ranking.test.ts`, `tests/BookmarkGrid.test.tsx`; modify `src/BookmarkGrid.tsx`, `src/App.tsx`, `src/style.css`, `tests/App.test.tsx`.

**Interfaces:**
- `rankBookmarks(bookmarks:Bookmark[], snapshot:UsageMap, pins:UsageMap):Bookmark[]` from `src/ranking.ts`.
- Grid props extend existing inputs with `usage:UsageMap`, `onOpen:(id:string)=>void`, `onPin:(id:string,pinned:boolean)=>void`.
- App holds separate initial frequency snapshot and current pin state. Newly created bookmarks have zero snapshot usage; deleted IDs are removed naturally from the source tree.

- [ ] Add ranking assertions: a pinned zero-count bookmark precedes an unpinned high-count bookmark; inside each group use count descending, recency descending, Chinese-friendly display-name ordering, then ID; duplicates remain distinct. Assert input arrays/maps are not mutated.
- [ ] Add interaction assertions: left/keyboard/modifier click records once, `auxclick` with button 1 records once, button 2 does not; edit/pin buttons do not invoke `onOpen`; default anchor navigation is not prevented. A pin action failure shows an error without committing a false pin state.
- [ ] Run targeted tests red, then implement ranking and existing-library pin icons with visible pinned marker, keyboard labels/pressed state and touch visibility.
- [ ] Wire App usage loading and pin updates. Send record messages synchronously from activation handlers; catch/report failures without delaying or preventing the anchor's default action. Preserve frequency snapshot during storage events, query changes and pin actions.
- [ ] Add regression: after an open/storage update, current order is unchanged; a fresh mount uses updated counts; pin changes are immediate. Run targeted and full tests, then commit.

### Task 3: Engine/bookmark input modes

**Files:** Create `src/SearchBar.tsx`, `src/engine-search.ts`, `tests/SearchBar.test.tsx`, `tests/engine-search.test.ts`; modify `src/App.tsx`, `src/style.css`, `public/manifest.json`, `tests/App.test.tsx`.

**Interfaces:**
- `SearchMode = 'engine'|'bookmarks'`; a controlled `SearchBar` receives `mode`, `query`, `onModeChange`, `onQueryChange`, `onSubmit` and error/busy state.
- `searchWithDefaultEngine(text:string):Promise<void>` trims input and uses `chrome.search.query({text,disposition:'CURRENT_TAB'})`, with runtime errors propagated. No hardcoded provider fallback.
- App defaults mode to `'engine'` on every mount. The existing bookmark filter consumes query only in `'bookmarks'` mode; clearing returns the full ranked grid.

- [ ] Write assertions: engine mode does not filter or search while typing; explicit nonblank submit calls the default engine once; blank/IME-composition/legacy composition key code 229 does not submit; bookmark-mode Enter calls no engine; API absence/errors remain actionable.
- [ ] Write mode-switch assertions: dropdown preserves query, bookmark mode applies it immediately, engine mode restores the full grid, remount resets mode to engine. Ensure clear and mode-switch buttons do not submit the form.
- [ ] Run targeted tests red, then implement accessible compact dropdown/form, mode-specific placeholder, composition protection, duplicate-submit protection and visible failure/retry path.
- [ ] Add only `search` to existing manifest permissions. Update the sorting info line and ensure narrow-screen controls do not push search input off-screen.
- [ ] Run targeted and full tests plus `npm run build`; commit.

### Task 4: Browser regression, release and documentation

**Files:** Modify `scripts/browser.mjs`, `scripts/smoke.mjs`, `README.md`, `package.json`, `package-lock.json`, `public/manifest.json`, `downloads/bookmark-grid-dist.zip`, `design-qa.md`; save screenshots under `docs/design/`.

- [ ] Extend browser fixtures with background-message simulation and captured `chrome.search.query` calls. Existing search tests explicitly select bookmark mode; assert engine default, submission payload, pins, next-load frequency ranking, shared size controls and persistence. Keep the real-extension smoke distinct from simulation.
- [ ] Run `npm test`, `npm run build`, `npm run test:browser` and `git diff --check`; preserve the known real-extension limitation rather than claiming it passed.
- [ ] Capture and inspect desktop/mobile search modes, pinned items and settings. Check focus, truncation, console errors, no typing-time external requests and actual layout/size values.
- [ ] Document cumulative-count semantics, cold start, stable within-page order, right-click-menu limitation, local privacy and explicit provider submissions; remove outdated claims that all page searches are local-only.
- [ ] Set a consistent next version (proposed `1.3.0`) in package/lock/manifest, rebuild and recreate ZIP. Verify archive integrity and manifest version/permissions inside it.
- [ ] Review the complete change against the approved spec, resolve material issues, then commit and push without force under the existing GitHub authorization. Confirm the remote SHA and provide the updated GitHub ZIP link, test evidence and real-Chrome acceptance limit.
