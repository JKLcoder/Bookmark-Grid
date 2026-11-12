export type SearchEngine = "browser" | "baidu" | "google";
export type Layout = {
  columns: number | "auto";
  rowGap: number;
  columnGap: number;
  itemSize: number;
  searchEngine: SearchEngine;
  openInNewTab: boolean;
};
export const DEFAULT_LAYOUT: Layout = {
  columns: 6,
  rowGap: 4,
  columnGap: 12,
  itemSize: 16,
  searchEngine: "browser",
  openInNewTab: false,
};
export const LAYOUT_FIELDS = [
  "columns",
  "rowGap",
  "columnGap",
  "itemSize",
  "searchEngine",
  "openInNewTab",
] as const;
function bounded(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}
export function normalizeLayout(value: Record<string, unknown>): Layout {
  return {
    columns:
      value.columns === "auto" ? "auto" : bounded(value.columns, 6, 1, 12),
    rowGap: bounded(value.rowGap, 4, 0, 32),
    columnGap: bounded(value.columnGap, 12, 0, 48),
    itemSize: bounded(value.itemSize, 16, 12, 28),
    searchEngine:
      value.searchEngine === "baidu" || value.searchEngine === "google"
        ? value.searchEngine
        : "browser",
    openInNewTab: value.openInNewTab === true,
  };
}
export function resolveColumns(
  columns: number | "auto",
  width: number,
  gap: number,
  size = 16,
  coarse = false,
): number {
  const minimum = size * 9 + 24 + (coarse ? 68 : 0);
  const capacity = Math.max(
    1,
    Math.floor((Math.max(0, width) + gap) / (minimum + gap)),
  );
  return columns === "auto"
    ? capacity
    : Math.max(1, Math.min(columns, capacity));
}
export async function loadLayout(): Promise<Layout> {
  const stored = await chrome.storage.local.get([
    "layout:columns",
    "layout:rowGap",
    "layout:columnGap",
    "layout:itemSize",
    "layout:searchEngine",
    "layout:openInNewTab",
  ]);
  return normalizeLayout({
    columns: stored["layout:columns"],
    rowGap: stored["layout:rowGap"],
    columnGap: stored["layout:columnGap"],
    itemSize: stored["layout:itemSize"],
    searchEngine: stored["layout:searchEngine"],
    openInNewTab: stored["layout:openInNewTab"],
  });
}
export async function saveLayoutPatch(patch: Partial<Layout>): Promise<void> {
  const safe = normalizeLayout({ ...patch });
  const entries = LAYOUT_FIELDS.filter((key) => Object.hasOwn(patch, key)).map(
    (key) => ["layout:" + key, safe[key]],
  );
  if (entries.length)
    await chrome.storage.local.set(Object.fromEntries(entries));
}
export async function saveLayoutField<K extends keyof Layout>(
  field: K,
  value: Layout[K],
): Promise<void> {
  await saveLayoutPatch({ [field]: value });
}
