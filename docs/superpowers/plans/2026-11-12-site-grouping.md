# Site Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Put non-pinned bookmarks from the same website next to one another.
**Architecture:** Extend pure rankBookmarks(bookmarks, snapshot, pins) with domain grouping and aggregate snapshot statistics. Rank before search in App. Retain all native item behavior and existing storage.
**Tech Stack:** React, TypeScript, URL, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-12-site-grouping-design.md

## Global Constraints
Flat grid, pins first, no new dependency/permission/storage. Existing stable within-page frequency snapshot.

## Review Focus
- www/protocol/path normalization without merging unrelated hosts.
- Pinned items do not break non-pinned adjacency.
- Search preserves full-site totals and order.
- Invalid and non-web URLs remain usable, duplicates preserved.
- Reload/pin changes retain established snapshot rules.

### Task 1: Grouped ranking and UI explanation
**Files:** src/ranking.ts, src/App.tsx, tests/ranking.test.ts, tests/App.test.tsx, scripts/browser.mjs, README.md.
**Interfaces:** retain rankBookmarks(bookmarks: Bookmark[], snapshot: UsageMap, pins: UsageMap): Bookmark[].
- [x] Add tests for adjacency, total/recency/name ordering, www aliases, distinct hosts/subdomains, pinned contribution, invalid/non-web URLs and search stability.
- [x] Run ranking and App tests; observe new adjacency/search regressions fail.
- [x] Implement grouped ranking, rank-before-filter, and update visible sorting explanation.
- [x] Add a duplicate-host browser scenario without changing existing fixtures' ordering assumptions.
- [x] Run full tests/build/browser checks, independent review, and diff check.
- [x] Update README, version, ZIP; commit and push under standing authorization.

## Verification record

Three new regressions failed before implementation. Final 107 tests across 12 files, TypeScript/Vite build and production-page browser regression pass. Independent whole-change review found no critical/important issues or deferred minors. No plan deviations. Native real-extension environment limitation remains documented.
