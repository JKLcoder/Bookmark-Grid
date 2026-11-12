import { useEffect, useRef } from "react";
import { Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
export type SearchMode = "engine" | "bookmarks";
interface Props {
  mode: SearchMode;
  query: string;
  onModeChange: (mode: SearchMode) => void;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  engineName?: string;
}
export default function SearchBar({
  mode,
  query,
  onModeChange,
  onQueryChange,
  onSubmit,
  busy,
  error,
  engineName = "默认搜索引擎",
}: Props) {
  const composing = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.isComposing &&
        !target?.closest('input,textarea,select,[contenteditable="true"]') &&
        !document.querySelector("dialog[open]")
      ) {
        event.preventDefault();
        input.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  return (
    <div>
      <form
        className="search-wrap"
        role="search"
        aria-label={mode === "engine" ? "网页搜索" : "书签搜索"}
        onSubmit={(event) => {
          event.preventDefault();
          if (mode === "engine" && query.trim() && !composing.current && !busy)
            onSubmit();
        }}
      >
        <label className="sr-only" htmlFor="search-mode">
          搜索模式
        </label>
        <select
          id="search-mode"
          className="search-mode"
          value={mode}
          onChange={(event) => onModeChange(event.target.value as SearchMode)}
        >
          <option value="engine">网页搜索</option>
          <option value="bookmarks">书签搜索</option>
        </select>
        <label className="sr-only" htmlFor="search">
          {mode === "engine" ? "搜索互联网" : "搜索书签"}
        </label>
        <input
          className="search-input"
          ref={input}
          id="search"
          type="search"
          placeholder={
            mode === "engine"
              ? "输入关键词，按 Enter 搜索"
              : "搜索名称、网址或文件夹…"
          }
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
          aria-describedby={error ? "engine-search-error" : undefined}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              (composing.current ||
                event.nativeEvent.isComposing ||
                event.keyCode === 229)
            )
              event.preventDefault();
          }}
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="icon-button search-clear"
            aria-label="清空搜索"
          >
            <Cross2Icon />
          </button>
        )}
        {mode === "engine" && (
          <>
            <span className="provider">
              {engineName === "默认搜索引擎" ? "Chrome 默认" : engineName}
            </span>
            <button
              className="primary search-submit"
              aria-label="提交网页搜索"
              type="submit"
              disabled={busy}
            >
              <MagnifyingGlassIcon aria-hidden="true" />
              <span>搜索</span>
            </button>
          </>
        )}
      </form>
      {error && (
        <div role="alert" id="engine-search-error" className="error-banner">
          <span>{error}</span>
          <button type="button" disabled={busy} onClick={onSubmit}>
            重试搜索
          </button>
        </div>
      )}
    </div>
  );
}
