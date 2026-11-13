import { attachRuntime } from "./helpers/runtime";
import { beforeEach, it, expect, vi } from "vitest";
import { loadBookmarks, saveName, subscribe, removeBookmark } from "../src/api";
function event() {
  const listeners = new Set<(...args: any[]) => void>();
  return {
    addListener: (fn: (...args: any[]) => void) => listeners.add(fn),
    removeListener: (fn: (...args: any[]) => void) => listeners.delete(fn),
    fire: () => listeners.forEach((fn) => fn()),
    listeners,
  };
}
let store: Record<string, unknown>;
let api: any;
beforeEach(() => {
  store = { "name:a": "别名", "name:gone": "过期", unrelated: 42 };
  api = {
    bookmarks: {
      getTree: vi.fn(async () => [
        {
          id: "0",
          title: "",
          children: [{ id: "a", title: "原标题", url: "https://a.test" }],
        },
      ]),
      onCreated: event(),
      onChanged: event(),
      onMoved: event(),
      onRemoved: event(),
    },
    storage: {
      local: {
        get: vi.fn(async () => ({ ...store })),
        set: vi.fn(async (v: object) => {
          Object.assign(store, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of [keys].flat()) delete store[key];
        }),
      },
      onChanged: event(),
    },
  };
  api.bookmarks.get=async (id:string)=>[{id,url:`https://${id}.test`}];
  attachRuntime(api);
  vi.stubGlobal("chrome", api);
});
it("loads real API tree with local aliases and cleans stale names only", async () => {
  expect(await loadBookmarks()).toEqual([
    {
      id: "a",
      title: "原标题",
      url: "https://a.test",
      folderPath: [],
      customName: "别名",
    },
  ]);
  expect(store).toEqual({ "name:a": "别名", unrelated: 42 });
});
it("saves trimmed aliases independently without changing bookmarks", async () => {
  api.bookmarks.getTree.mockResolvedValue([{id:"a",url:"https://a.test"},{id:"b",url:"https://b.test"}]);
  await Promise.all([saveName("a", " A "), saveName("b", "B")]);
  expect(store["name:a"]).toBe("A");
  expect(store["name:b"]).toBe("B");
  expect(api.bookmarks.update).toBeUndefined();
});
it("removes alias when reset", async () => {
  await saveName("a", "  ");
  expect(store["name:a"]).toBeUndefined();
});
it("propagates storage failure", async () => {
  api.storage.local.set.mockRejectedValue(new Error("quota"));
  await expect(saveName("a", "A")).rejects.toThrow("quota");
});
it("does not clean names if bookmark read fails", async () => {
  api.bookmarks.getTree.mockRejectedValue(new Error("read"));
  await expect(loadBookmarks()).rejects.toThrow("read");
  expect(store["name:gone"]).toBe("过期");
});
it("subscribes to all four events and storage changes, then unsubscribes", () => {
  let calls = 0;
  const stop = subscribe(() => calls++);
  for (const e of [
    api.bookmarks.onCreated,
    api.bookmarks.onChanged,
    api.bookmarks.onMoved,
    api.bookmarks.onRemoved,
    api.storage.onChanged,
  ])
    e.fire();
  expect(calls).toBe(5);
  stop();
  api.bookmarks.onCreated.fire();
  expect(calls).toBe(5);
  expect(api.storage.onChanged.listeners.size).toBe(0);
});
it("reports unavailable extension APIs instead of showing fake bookmarks", async () => {
  vi.stubGlobal("chrome", undefined);
  await expect(loadBookmarks()).rejects.toThrow("扩展");
});

it("removes only the selected URL bookmark through Chrome", async () => {
  api.bookmarks.get = vi.fn(async () => [{ id: "a", url: "https://a.test" }]);
  api.bookmarks.remove = vi.fn(async () => {});
  await removeBookmark("a");
  expect(api.bookmarks.get).toHaveBeenCalledWith("a");
  expect(api.bookmarks.remove).toHaveBeenCalledExactlyOnceWith("a");
  expect(api.storage.local.remove).not.toHaveBeenCalled();
});
it("refuses folder deletion", async () => {
  api.bookmarks.get = vi.fn(async () => [{ id: "folder", children: [] }]);
  api.bookmarks.remove = vi.fn();
  await expect(removeBookmark("folder")).rejects.toThrow(
    "只能删除单个网页书签",
  );
  expect(api.bookmarks.remove).not.toHaveBeenCalled();
});
it("propagates Chrome deletion failures without deleting local data", async () => {
  api.bookmarks.get = vi.fn(async () => [{ id: "a", url: "https://a.test" }]);
  api.bookmarks.remove = vi.fn().mockRejectedValue(Error("禁止删除"));
  await expect(removeBookmark("a")).rejects.toThrow("禁止删除");
  expect(api.storage.local.remove).not.toHaveBeenCalled();
});
