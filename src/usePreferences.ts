import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LAYOUT,
  LAYOUT_FIELDS,
  normalizeLayout,
  saveLayoutPatch,
  type Layout,
} from "./layout";
export type SaveStatus = { phase: "saved" | "saving" | "error"; error: string };
type Key = keyof Layout;
type Edit = { value: Layout[Key]; version: number };

/** Page-owned preview and write queue survive settings-panel unmounts. */
export function usePreferences() {
  const [layout, setLayout] = useState<Layout>({ ...DEFAULT_LAYOUT });
  const [status, setStatus] = useState<SaveStatus>({
    phase: "saved",
    error: "",
  });
  const current = useRef<Layout>({ ...DEFAULT_LAYOUT });
  const acknowledged = useRef<Layout>({ ...DEFAULT_LAYOUT });
  const dirty = useRef(new Map<Key, Edit>());
  const generation = useRef(0);
  const editVersion = useRef(0);
  const epoch = useRef(0);
  const pending = useRef(0);
  const failure = useRef("");
  const queue = useRef(Promise.resolve());
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const publish = useCallback(() => {
    if (!mounted.current) return;
    setLayout({ ...current.current });
    const phase = pending.current
      ? "saving"
      : dirty.current.size
        ? "error"
        : "saved";
    setStatus({
      phase,
      error: phase === "error" ? failure.current || "保存失败，请重试。" : "",
    });
  }, []);
  const change = useCallback(
    (patch: Partial<Layout>) => {
      const safe = normalizeLayout({ ...current.current, ...patch });
      const keys = LAYOUT_FIELDS.filter((key) => Object.hasOwn(patch, key));
      if (!keys.length) return;
      const edits = new Map<Key, Edit>();
      const write: Partial<Layout> = {};
      for (const key of keys) {
        const edit = { value: safe[key], version: ++editVersion.current };
        edits.set(key, edit);
        dirty.current.set(key, edit);
        Object.assign(current.current, { [key]: edit.value });
        Object.assign(write, { [key]: edit.value });
      }
      generation.current++;
      pending.current++;
      const taskEpoch = epoch.current;
      publish();
      queue.current = queue.current
        .then(async () => {
          if (taskEpoch !== epoch.current) return;
          try {
            await saveLayoutPatch(write);
            if (taskEpoch !== epoch.current) return;
            generation.current++;
            Object.assign(acknowledged.current, write);
            for (const [key, edit] of edits)
              if (dirty.current.get(key)?.version === edit.version)
                dirty.current.delete(key);
          } catch (error) {
            if (
              taskEpoch === epoch.current &&
              [...edits].some(
                ([key, edit]) =>
                  dirty.current.get(key)?.version === edit.version,
              )
            ) {
              failure.current =
                error instanceof Error ? error.message : "保存失败，请重试。";
            }
          }
        })
        .finally(() => {
          pending.current--;
          publish();
        });
    },
    [publish],
  );
  const adopt = useCallback(
    (next: Layout, token: number) => {
      // A read started before a local edit/ack must not overwrite the preview.
      if (token !== generation.current) return;
      const safe = normalizeLayout({ ...next });
      const baseline = { ...safe };
      for (const key of dirty.current.keys())
        Object.assign(baseline, { [key]: acknowledged.current[key] });
      acknowledged.current = baseline;
      const preview = { ...safe };
      for (const [key, edit] of dirty.current)
        Object.assign(preview, { [key]: edit.value });
      current.current = preview;
      publish();
    },
    [publish],
  );
  const retry = useCallback(() => {
    if (pending.current) return;
    change(
      Object.fromEntries(
        [...dirty.current].map(([key, edit]) => [key, edit.value]),
      ) as Partial<Layout>,
    );
  }, [change]);
  const undo = useCallback(() => {
    if (!dirty.current.size) return;
    const rollback = Object.fromEntries(
      [...dirty.current.keys()].map((key) => [key, acknowledged.current[key]]),
    ) as Partial<Layout>;
    // Skip queued old edits; a compensation write follows any already in-flight write.
    epoch.current++;
    generation.current++;
    dirty.current.clear();
    failure.current = "";
    change(rollback);
  }, [change]);
  return { layout, status, generation, adopt, change, retry, undo };
}
