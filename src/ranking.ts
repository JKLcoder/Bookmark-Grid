import { sortBookmarks, type Bookmark } from "./bookmarks";
import type { UsageMap } from "./usage";

function siteKey(bookmark: Bookmark): string {
  try {
    const url = new URL(bookmark.url);
    if (url.protocol === "http:" || url.protocol === "https:") {
      const host = url.hostname
        .toLowerCase()
        .replace(/\.$/, "")
        .replace(/^www\./, "");
      return `site:${host}`;
    }
  } catch {
    /* Non-web and malformed bookmarks retain independent positions. */
  }
  return `bookmark:${bookmark.id}`;
}

export function rankBookmarks(
  bookmarks: Bookmark[],
  snapshot: UsageMap,
  pins: UsageMap,
): Bookmark[] {
  // Seed stable ties with the existing Chinese-friendly display-name/ID order.
  const ordered = sortBookmarks(bookmarks);
  const byUsage = (a: Bookmark, b: Bookmark) =>
    (snapshot[b.id]?.count ?? 0) - (snapshot[a.id]?.count ?? 0) ||
    (snapshot[b.id]?.lastOpened ?? 0) - (snapshot[a.id]?.lastOpened ?? 0);
  const pinned: Bookmark[] = [];
  const groups = new Map<
    string,
    { members: Bookmark[]; count: number; lastOpened: number }
  >();
  // Totals include pinned bookmarks, while pins themselves stay outside the groups.
  for (const bookmark of ordered) {
    const key = siteKey(bookmark);
    let group = groups.get(key);
    if (!group) {
      group = { members: [], count: 0, lastOpened: 0 };
      groups.set(key, group);
    }
    group.count += snapshot[bookmark.id]?.count ?? 0;
    group.lastOpened = Math.max(
      group.lastOpened,
      snapshot[bookmark.id]?.lastOpened ?? 0,
    );
    if (pins[bookmark.id]?.pinned === true) pinned.push(bookmark);
    else group.members.push(bookmark);
  }
  return [
    ...pinned.sort(byUsage),
    ...[...groups.values()]
      .filter((group) => group.members.length > 0)
      .sort((a, b) => b.count - a.count || b.lastOpened - a.lastOpened)
      .flatMap((group) => group.members.sort(byUsage)),
  ];
}
