# Bookmark Grid Implementation Plan

Goal: Deliver the user's complete local-only MV3 bookmark access MVP.
Architecture: Pure bookmark helpers, serialized Chrome storage/API adapter, React page, background deletion cleanup.
Stack: React, TypeScript, Vite, Vitest; no backend or remote assets.
Spec: User's nine-section requirements in this task.

## Constraints
Only bookmarks/storage permissions; never mutate original bookmarks. Preserve duplicate URLs and nested paths. Real anchors preserve browser navigation gestures. Persist only aliases keyed by bookmark ID.

## Tasks
- [x] Write tests for flat/nested/empty/duplicate trees, title fallback, search fields, Chinese ordering and alias pruning. Run red, implement helpers, run green.
- [x] Test API reads, alias persistence/removal, all bookmark event subscriptions, concurrent storage writes and error behavior; implement serialized adapter and cleanup worker.
- [x] Test UI loading, empty/error states, search and rename; implement responsive text grid, accessible editing dialog and settings information.
- [x] Run complete tests and TypeScript/Vite build. Verify built page in browser with injected Chrome mock; attempt unpacked extension smoke validation where available.
- [x] Document source layout and Chrome loading instructions; save tested environment install/start instructions.

## Review focus
Storage failures must remain visible; concurrent renames must not lose other aliases; refresh must not overwrite newer data; deleted folders must clean descendant aliases even with no page open; long titles/keyboard focus must remain usable.

## Verification outcome
32 unit/integration tests pass. TypeScript/Vite build passes; dist is generated. Production-page Chromium smoke passes with a simulated Chrome API; desktop/mobile screenshots inspected. Actual unpacked-extension smoke was attempted and failed waiting for its service worker in the managed Chromium instance; it remains unverified and optional here. Install/start configuration saved as a draft; publication requires the user.
