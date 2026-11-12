# Bookmark Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Delete an original Chrome bookmark through the confirmed edit-dialog flow.
**Architecture:** Add a removeBookmark(id) API wrapper that checks the ID is a URL node before chrome.bookmarks.remove. Extend the existing edit modal with a confirmation state; reuse onRemoved cleanup and explicit post-success refresh. Keep deletion errors separate from local cleanup failures.
**Tech Stack:** React, TypeScript, Chrome MV3, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-12-bookmark-delete-design.md

## Global Constraints
No new dependencies or permissions. Single bookmark ID only. Existing aliases, layout and native link behavior stay intact.

## Review Focus
- Duplicate URL: only selected ID disappears.
- Rejected Chrome remove: retain bookmark and confirmation for retry.
- Repeated activation while pending: exactly one API call.
- Cancel/Escape: no deletion; Cancel receives initial confirmation focus.
- Cleanup fails after deletion: refresh reports truthful state and retries existing cleanup later.

### Task 1: API and confirmation workflow
**Files:** src/api.ts, src/App.tsx, src/style.css, tests/api.test.ts, tests/App.test.tsx, scripts/browser.mjs, README.md
**Interfaces:** removeBookmark(id: string): Promise<void>; existing Rename.onSaved() refreshes after success.
- [x] Add API tests: remove only selected URL node, reject folders and propagate remove error without touching storage.
- [x] Add UI tests: cancellation, duplicate URLs, retry on failure, pending double-submit suppression.
- [x] Run npm test and observe missing API/control failures.
- [x] Implement API guard and modal confirmation, focus Cancel, busy guards and error feedback.
- [x] Add browser deletion fixture and verify real DOM confirmation, Escape, successful removal and local record cleanup.
- [x] Run npm test, npm run build, npm run test:browser and git diff --check.
- [x] Update README/version/package ZIP, review, commit and push.

## Execution record

- Native inline execution on existing work branch, approved design and standing push authorization.
- API/UI regression tests failed before implementation (six missing API/control cases); the post-success cleanup-failure regression also failed before immediate ID filtering.
- Native browser initial-focus regression failed before explicitly focusing Cancel after showModal; final browser run passed.
- Final verification: 102 tests across 12 files; TypeScript/Vite build; production-page browser regression; git diff --check all pass.
- Fresh independent whole-change review: no actionable Critical/Important findings or deferred minors.
- Real unpacked extension validation remains blocked by managed Chromium policy; documented in README and design QA.
