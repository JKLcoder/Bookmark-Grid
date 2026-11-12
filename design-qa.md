# Bookmark Grid 1.1 design QA

final result: passed

## Evidence and state

- Source visual truth: `docs/design/reference.png`, the user's approved revised dark compact design.
- Browser-rendered implementation: `docs/design/implemented-settings.png`.
- CSS viewport: 1487 × 1058, deviceScaleFactor 1. Source and implementation both 1487 × 1058 pixels; no density normalization was required.
- State: 36 bookmarks, dark surface, title-only grid, six requested columns, row gap 4px, column gap 12px, settings open, one bookmark hovered.
- Full-view comparison: `docs/design/comparison.png`, both complete captures rendered together at equal 50% scale in a browser.
- Focused settings comparison: `docs/design/settings-comparison.png`, source and implementation settings regions rendered together at native scale. This checks readable typography, inputs, sliders, spacing and action buttons.
- Narrow-screen evidence: `docs/design/mobile-settings.png`, 390px CSS viewport; controls remain accessible without horizontal overflow. Grid reduces to two columns without changing the stored six-column preference.

## Comparison history

1. Initial visual pass: `docs/design/comparison-initial.png` and `docs/design/settings-comparison-initial.png`.
   - P2: Grid and settings typography were visibly undersized relative to the target, and row rhythm compressed the grid more than necessary for comfortable reading.
   - Fix: Increased grid names to 16px, row hit area to 42px, product title to 22px, settings labels to 16px and settings heading to 20px. Adjusted the search/info spacing and right-aligned the column selector.
2. Post-fix capture: current full-view and focused comparisons listed above. No remaining actionable P0/P1/P2 issues.

## Required fidelity surfaces

- Fonts/typography: local system sans-serif and Chinese fallback; readable single-line bookmark names, ellipsis for long names, title-only hierarchy. Generated-reference letterforms are approximated with installed fonts rather than remote fonts.
- Spacing/layout: compact header/search/info sequence; flat six-column grid with 4px/12px configurable gaps, hover-only editing affordance, anchored settings overlay and restrained footer. Six actual equal-width tracks span the page; this resolves the image's ambiguous column positioning beneath its overlay. The interface remains substantially denser than the original MVP.
- Colors/tokens: graphite `#191d20`, foreground `#e7eae6`, mint accent `#9ac9ae`, overlay `#252b2d`. Flat surfaces intentionally omit the generated mock's raster texture. Secondary text stays readable.
- Image/assets: no raster decoration is needed. Gear, magnifier, close and pencil icons use the bundled Radix Icons library; no remote image requests, emoji or handcrafted icon approximations.
- Copy/content: product name, search, count, pinyin sorting, layout controls, gap units, narrow-screen note, restore-default action and local-privacy footer retained. Bookmark names are actual sorted fixture data. URLs/domains are hidden in the grid and rename dialog, but preserved as href targets and searchable data.

## Functional evidence

- `npm test`: 42 passing tests covering existing behavior and layout normalization, bounds, responsive column calculation, persistence, restore defaults and save errors.
- `npm run build`: TypeScript and Vite pass.
- `npm run test:browser`: passes against the production bundle in Chromium with a simulated Chrome API. Exercises search, rename, reload, native modal Escape, columns, keyboard slider adjustments, saved gaps after reload, reset, desktop/mobile layouts, no external page requests and no page runtime errors.
- Real unpacked Chrome extension smoke remains unverified in this managed browser, as documented in README; this is not represented as passed by the mocked browser check.

## Follow-up polish

- P3: Browser-native select and range controls have small platform-dependent differences from the generated image; behavior and visible values are correct.
- P3: OS-dependent font rendering may differ slightly from the reference.

## Implementation checklist

- [x] Dark compact title-only layout.
- [x] Automatic or 1–12 requested columns, with responsive safety cap.
- [x] Configurable row/column gaps, immediate preview, independent local storage keys and reset.
- [x] Existing search, aliases, native navigation and bookmark events preserved.
- [x] Desktop/mobile browser validation and post-fix visual comparison.

## 1.2 incremental change: website favicons and shared sizing

User-directed changes supersede the title-only/no-icons portion of the earlier visual target: small favicon before each name, and a single setting for both text and icon size. The dark layout, grid, spacing controls, edit behavior and navigation remain intact.

- Current desktop evidence: `docs/design/favicon-desktop.png` at 1487 × 1058, scale 1, settings open and one bookmark hovered.
- Current mobile evidence: `docs/design/favicon-mobile.png` at 390px, scale 1. Added control fits the panel without horizontal overflow.
- Both screenshots inspected directly. Icons align vertically with names and retain the same computed size as the font. The browser fixture has no extension runtime, so screenshots intentionally show the bundled generic fallback, not actual site favicons.
- Browser checks confirm exact icon width/height and text font-size at both 12px and 28px, setting persistence after reload, and reset to 16px. Images are decorative and do not alter accessible link names. No external requests or page errors.
- Unit tests cover Chrome internal favicon URL construction and encoding, non-web URL handling, missing runtime fallback, image load errors, persisted size bounds and old-setting defaults.
- 49 tests pass. TypeScript/Vite build and production-page Chromium check pass. Actual favicon appearance through Chrome's extension runtime remains a personal-Chrome acceptance check; this managed environment does not support the real extension smoke as previously documented.
- Added `favicon` permission and Chrome 93 minimum version. No host permissions, third-party favicon endpoints or bookmark mutations.
- Current incremental visual result: passed; no actionable P0/P1/P2 findings.

## 1.3 incremental change: frequency, pins and dual search

Approved reference: `docs/superpowers/specs/2026-11-12-frequency-pins-search-design.md`; retain the existing dark visual system and implement the approved new dropdown/pin interactions.

- Desktop engine mode: `docs/design/engine-mode.png` at 1487 × 1058, scale 1, one pinned bookmark and one hovered bookmark.
- Bookmark mode: `docs/design/bookmark-mode.png`, same viewport, matching URL search results.
- Mobile engine mode: `docs/design/dual-search-mobile.png`, 390px CSS width, full-page capture. Dropdown/input fit without horizontal overflow; names truncate instead of hiding controls.
- Inspected browser captures directly. Typography/tokens and grid spacing remain consistent with the existing compact direction. Standard pin icons are bundled Radix icons. The persistent filled pin remains visible; hover/focus reveals edit and unfilled pin actions.
- Production-page Chromium fixture uses the real `usage-store.js` behind simulated Chrome messaging and a simulated Chrome search API; no claim of actual default-provider navigation is made. Browser assertions verify default mode, explicit search request payload, no typing-time submission, bookmark filtering, immediate pins, three middle-button activations, stable current order and updated order after reload.
- Existing layout/font/icon-size and persistence checks still pass, including 12px and 28px sizing; no page runtime errors or external fixture requests.
- Full unit/integration suite: 77 passing at release preparation; TypeScript/Vite build and browser smoke pass. Real unpacked extension smoke remains unavailable in this managed instance.
- Visual result: passed; no actionable P0/P1/P2 issues. Expected follow-up: verify native default search navigation and actual favicon cache behavior in personal Chrome.
