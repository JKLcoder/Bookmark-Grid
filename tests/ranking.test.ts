import { it, expect } from "vitest";
import { rankBookmarks } from "../src/ranking";
const data = ["中", "阿", "波"].map((title, i) => ({
  id: String(i),
  title,
  url: "https://same.test",
  folderPath: [],
}));
it("puts pins before high-frequency bookmarks", () => {
  expect(
    rankBookmarks(
      data,
      { "0": { count: 99, lastOpened: 9, pinned: false } },
      { "1": { count: 0, lastOpened: 0, pinned: true } },
    ).map((b) => b.id),
  ).toEqual(["1", "0", "2"]);
});
it("orders by count then recency then Chinese name without mutating inputs", () => {
  const usage = {
    "0": { count: 2, lastOpened: 8, pinned: false },
    "1": { count: 2, lastOpened: 9, pinned: false },
    "2": { count: 3, lastOpened: 1, pinned: false },
  };
  expect(rankBookmarks(data, usage, {}).map((b) => b.id)).toEqual([
    "2",
    "1",
    "0",
  ]);
  expect(data.map((b) => b.id)).toEqual(["0", "1", "2"]);
});
it("cold starts by display name and preserves duplicated URLs", () => {
  expect(rankBookmarks(data, {}, {}).map((b) => b.title)).toEqual([
    "阿",
    "波",
    "中",
  ]);
});
it("pin metadata does not change the page frequency snapshot", () => {
  const snapshot = { "0": { count: 1, lastOpened: 1, pinned: false } };
  const latest = { "1": { count: 99, lastOpened: 99, pinned: false } };
  expect(rankBookmarks(data, snapshot, latest)[0].id).toBe("0");
});
it("keeps sites adjacent and orders them by summed usage before individual popularity", () => {
  const items = [
    {
      id: "g1",
      title: "GitHub A",
      url: "https://github.com/a",
      folderPath: [],
    },
    { id: "x", title: "Other", url: "https://other.test", folderPath: [] },
    {
      id: "g2",
      title: "GitHub B",
      url: "http://www.github.com/b",
      folderPath: [],
    },
  ];
  const snap = {
    g1: { count: 4, lastOpened: 1, pinned: false },
    g2: { count: 4, lastOpened: 2, pinned: false },
    x: { count: 7, lastOpened: 9, pinned: false },
  };
  expect(rankBookmarks(items, snap, {}).map((b) => b.id)).toEqual([
    "g2",
    "g1",
    "x",
  ]);
});
it("keeps pins first while their snapshot counts contribute to site totals", () => {
  const items = [
    { id: "pin", title: "Pinned", url: "https://github.com/p", folderPath: [] },
    { id: "g", title: "Repo", url: "https://github.com/r", folderPath: [] },
    { id: "x", title: "Other", url: "https://other.test", folderPath: [] },
  ];
  const snap = {
    pin: { count: 20, lastOpened: 1, pinned: false },
    x: { count: 10, lastOpened: 9, pinned: false },
  };
  expect(
    rankBookmarks(items, snap, {
      pin: { count: 0, lastOpened: 0, pinned: true },
    }).map((b) => b.id),
  ).toEqual(["pin", "g", "x"]);
});
it("does not merge distinct subdomains, non-web or invalid URL bookmarks", () => {
  const items = [
    { id: "a", title: "阿", url: "javascript:alert(1)", folderPath: [] },
    { id: "b", title: "波", url: "https://github.com/b", folderPath: [] },
    { id: "c", title: "中", url: "javascript:alert(2)", folderPath: [] },
    { id: "d", title: "丁", url: "https://gist.github.com/d", folderPath: [] },
    { id: "e", title: "我", url: "invalid", folderPath: [] },
  ];
  expect(rankBookmarks(items, {}, {}).map((b) => b.id)).toEqual([
    "a",
    "b",
    "d",
    "e",
    "c",
  ]);
});
it("breaks equal site totals by recency then Chinese display name", () => {
  const items = [
    { id: "a", title: "阿", url: "https://a.test", folderPath: [] },
    { id: "b", title: "波", url: "https://b.test", folderPath: [] },
    { id: "c", title: "中", url: "https://c.test", folderPath: [] },
  ];
  const snap = {
    a: { count: 2, lastOpened: 1, pinned: false },
    b: { count: 2, lastOpened: 3, pinned: false },
    c: { count: 2, lastOpened: 3, pinned: false },
  };
  expect(rankBookmarks(items, snap, {}).map((b) => b.id)).toEqual([
    "b",
    "c",
    "a",
  ]);
});
