import {attachRuntime} from "./helpers/runtime";
// @vitest-environment jsdom
import { it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { usePreferences } from "../src/usePreferences";
import { DEFAULT_LAYOUT } from "../src/layout";
let data: Record<string, unknown>;
beforeEach(() => {
  data = {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: async()=>({...data}),
        set: vi.fn(async (patch: object) => Object.assign(data, patch)),
      },
    },
  });
  attachRuntime(chrome);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("keeps failed preview through refresh and can retry after the panel is gone", async () => {
  const { result } = renderHook(usePreferences);
  act(() =>
    result.current.adopt(DEFAULT_LAYOUT, result.current.generation.current),
  );
  (chrome.storage.local.set as any).mockRejectedValueOnce(Error("quota"));
  act(() => result.current.change({ columns: 8 }));
  await waitFor(() => expect(result.current.status.phase).toBe("error"));
  act(() =>
    result.current.adopt(DEFAULT_LAYOUT, result.current.generation.current),
  );
  expect(result.current.layout.columns).toBe(8);
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.status.phase).toBe("saved"));
  expect(data["layout:columns"]).toBe(8);
});
it("ignores reads started before a local change or write acknowledgement", async () => {
  const { result } = renderHook(usePreferences);
  const token = result.current.generation.current;
  act(() => result.current.change({ searchEngine: "google" }));
  await waitFor(() => expect(result.current.status.phase).toBe("saved"));
  act(() => result.current.adopt(DEFAULT_LAYOUT, token));
  expect(result.current.layout.searchEngine).toBe("google");
});
it("retains newest changes when an older write fails", async () => {
  const { result } = renderHook(usePreferences);
  (chrome.storage.local.set as any).mockRejectedValueOnce(Error("old"));
  act(() => {
    result.current.change({ columns: 8 });
    result.current.change({ columns: 9 });
  });
  await waitFor(() => expect(result.current.status.phase).toBe("saved"));
  expect(result.current.layout.columns).toBe(9);
  expect(data["layout:columns"]).toBe(9);
});
it("undoes only unsaved fields to their acknowledged values", async () => {
  const { result } = renderHook(usePreferences);
  act(() =>
    result.current.adopt(
      { ...DEFAULT_LAYOUT, searchEngine: "google", rowGap: 7 },
      result.current.generation.current,
    ),
  );
  (chrome.storage.local.set as any).mockRejectedValueOnce(Error("quota"));
  act(() => result.current.change({ rowGap: 15 }));
  await waitFor(() => expect(result.current.status.phase).toBe("error"));
  act(() => result.current.undo());
  await waitFor(() => expect(result.current.status.phase).toBe("saved"));
  expect(result.current.layout.rowGap).toBe(7);
  expect(result.current.layout.searchEngine).toBe("google");
  expect(data["layout:rowGap"]).toBe(7);
  expect(data["layout:searchEngine"]).toBeUndefined();
});
it("compensates an in-flight write when undo is requested", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  (chrome.storage.local.set as any).mockImplementationOnce(
    async (patch: object) => {
      await gate;
      Object.assign(data, patch);
    },
  );
  const { result } = renderHook(usePreferences);
  act(() => result.current.change({ columns: 10 }));
  await waitFor(() =>
    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1),
  );
  act(() => result.current.undo());
  act(() => release());
  await waitFor(() => expect(result.current.status.phase).toBe("saved"));
  expect(data["layout:columns"]).toBe(6);
  expect(result.current.layout.columns).toBe(6);
});
it("saves grouped resets as a patch without changing unrelated preferences", async () => {
  const { result } = renderHook(usePreferences);
  act(() =>
    result.current.adopt(
      {
        ...DEFAULT_LAYOUT,
        columns: 10,
        searchEngine: "google",
        openInNewTab: true,
      },
      result.current.generation.current,
    ),
  );
  act(() =>
    result.current.change({
      columns: 6,
      rowGap: 4,
      columnGap: 12,
      itemSize: 16,
    }),
  );
  await waitFor(() => expect(result.current.status.phase).toBe("saved"));
  expect(result.current.layout.searchEngine).toBe("google");
  expect(result.current.layout.openInNewTab).toBe(true);
  expect(Object.keys(data).filter(key=>!key.startsWith("sync:")).sort()).toEqual([
    "layout:columnGap",
    "layout:columns",
    "layout:itemSize",
    "layout:rowGap",
  ]);
});
it('does not turn an unacknowledged mirrored preview into the undo baseline',async()=>{
 const {result}=renderHook(usePreferences);act(()=>result.current.adopt(DEFAULT_LAYOUT,result.current.generation.current));
 (chrome.storage.local.set as any).mockRejectedValueOnce(Error('quota'));act(()=>result.current.change({columns:8}));await waitFor(()=>expect(result.current.status.phase).toBe('error'));
 act(()=>result.current.adopt({...DEFAULT_LAYOUT,columns:8},result.current.generation.current));act(()=>result.current.undo());await waitFor(()=>expect(result.current.status.phase).toBe('saved'));expect(result.current.layout.columns).toBe(6);
});
