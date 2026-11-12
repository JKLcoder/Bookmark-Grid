import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Cross2Icon, GearIcon } from "@radix-ui/react-icons";
import SearchBar, { type SearchMode } from "./SearchBar";
import { searchWithEngine, ENGINE_NAMES } from "./engine-search";
import BookmarkGrid from "./BookmarkGrid";
import LayoutSettings from "./LayoutSettings";
import { loadLayout } from "./layout";
import { loadUsage, recordOpen, setPinned, type UsageMap } from "./usage";
import { usePreferences } from "./usePreferences";
import { SaveBadge, PreferenceFeedback } from "./PreferenceFeedback";
import { rankBookmarks } from "./ranking";
import { loadBookmarks, saveName, subscribe } from "./api";
import { searchBookmarks, type Bookmark } from "./bookmarks";

function Modal({
  title,
  onClose,
  children,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="关闭"
          onClick={onClose}
          disabled={busy}
        >
          <Cross2Icon />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Rename({
  bookmark,
  onClose,
  onSaved,
}: {
  bookmark: Bookmark;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(bookmark.customName ?? bookmark.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(value: string) {
    setSaving(true);
    setError("");
    try {
      await saveName(bookmark.id, value);
      onSaved();
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请重试。");
      setSaving(false);
    }
  }
  return (
    <Modal title="编辑显示名称" onClose={onClose} busy={saving}>
      <p className="muted">只修改此页的名称，Chrome 原始书签保持不变。</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(name);
        }}
      >
        <label htmlFor="display-name">显示名称</label>
        <input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          disabled={saving}
        />
        <p className="original">原标题：{bookmark.title || "（无标题）"}</p>
        <p className="muted">留空可恢复原标题。</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={() => void save("")} disabled={saving}>
            恢复原标题
          </button>
          <span />
          <button type="button" onClick={onClose} disabled={saving}>
            取消
          </button>
          <button className="primary" disabled={saving} type="submit">
            {saving ? "保存中…" : "保存名称"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export default function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [settings, setSettings] = useState(false);
  const { layout, status, generation, adopt, change, retry, undo } =
    usePreferences();
  const [actualColumns, setActualColumns] = useState(6);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const [mode, setMode] = useState<SearchMode>("engine");
  const [searchError, setSearchError] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const searching = useRef(false);
  const [usage, setUsage] = useState<UsageMap>({});
  const [snapshot, setSnapshot] = useState<UsageMap>({});
  const initialUsage = useRef<UsageMap | null>(null);
  const [notice, setNotice] = useState("");
  const closeSettings = useCallback((restoreFocus = true) => {
    setSettings(false);
    if (restoreFocus) settingsTrigger.current?.focus();
  }, []);
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let active = true;
    let revision = 0;
    async function refresh() {
      const current = ++revision;
      const preferenceToken = generation.current;
      try {
        const [data, savedLayout] = await Promise.all([
          loadBookmarks(),
          loadLayout(),
        ]);
        if (active && current === revision) {
          setBookmarks(data);
          adopt(savedLayout, preferenceToken);
          setError("");
        }
        try {
          const latest = await loadUsage();
          if (active && current === revision) {
            setUsage(latest);
            setNotice("");
            if (initialUsage.current === null) {
              initialUsage.current = latest;
              setSnapshot(latest);
            }
          }
        } catch (error) {
          if (active && current === revision) {
            if (initialUsage.current === null) {
              initialUsage.current = {};
              setSnapshot({});
            }
            setNotice(
              `本地使用数据读取失败：${error instanceof Error ? error.message : "请重试"}`,
            );
          }
        }
      } catch (error) {
        if (active && current === revision)
          setError(
            error instanceof Error ? error.message : "读取书签失败，请重试。",
          );
      } finally {
        if (active && current === revision) setLoading(false);
      }
    }
    refreshRef.current = () => void refresh();
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribe(() => void refresh());
    } catch {
      /* loadBookmarks supplies the user-facing API error. */
    }
    void refresh();
    return () => {
      active = false;
      revision++;
      unsubscribe();
    };
  }, [adopt, generation]);
  const visible = rankBookmarks(
    searchBookmarks(bookmarks, mode === "bookmarks" ? query : ""),
    snapshot,
    usage,
  );
  async function submitSearch() {
    if (loading || mode !== "engine" || !query.trim() || searching.current)
      return;
    searching.current = true;
    setSearchBusy(true);
    setSearchError("");
    try {
      await searchWithEngine(query, layout.searchEngine);
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : "搜索失败，请重试。",
      );
    } finally {
      searching.current = false;
      setSearchBusy(false);
    }
  }
  function opened(id: string) {
    void recordOpen(id).catch((error) =>
      setNotice(
        `使用记录保存失败：${error instanceof Error ? error.message : "请重试"}`,
      ),
    );
  }
  async function pin(id: string, pinned: boolean) {
    try {
      await setPinned(id, pinned);
      setUsage((previous) => ({
        ...previous,
        [id]: {
          count: previous[id]?.count ?? 0,
          lastOpened: previous[id]?.lastOpened ?? 0,
          pinned,
        },
      }));
    } catch (error) {
      setNotice(
        `置顶保存失败：${error instanceof Error ? error.message : "请重试"}`,
      );
    }
  }
  return (
    <main>
      <header className="app-header">
        <div className="brand">
          <h1>Bookmark Grid</h1>
        </div>
        <div className="header-actions">
          <SaveBadge status={status} loading={loading} live />
          <button
            ref={settingsTrigger}
            data-settings-trigger
            type="button"
            className="settings-trigger"
            onClick={() => (settings ? closeSettings(true) : setSettings(true))}
            disabled={loading}
            aria-label="设置"
            aria-expanded={settings}
            aria-controls="layout-settings"
          >
            <span>设置</span>
            <GearIcon />
          </button>
        </div>
      </header>
      <section className="workspace" aria-label="书签">
        <SearchBar
          mode={mode}
          query={query}
          onModeChange={(value) => {
            setMode(value);
            setSearchError("");
          }}
          onQueryChange={(value) => {
            setQuery(value);
            setSearchError("");
          }}
          onSubmit={() => void submitSearch()}
          busy={searchBusy || loading}
          error={searchError}
          engineName={ENGINE_NAMES[layout.searchEngine]}
        />
        <div className="info" aria-live="polite">
          <span>
            {loading
              ? "正在读取书签…"
              : mode === "bookmarks" && query.trim()
                ? `${visible.length} / ${bookmarks.length} 个书签`
                : `${bookmarks.length} 个书签`}
          </span>
          <div className="info-right">
            <span
              className="sort-copy"
              title="置顶优先，然后按累计打开次数和最近使用时间排序。频率从启用后开始记录，在下次打开或刷新时更新。"
            >
              置顶优先 · 使用频率
            </span>
            <span className="shortcut">
              <kbd>/</kbd>定位搜索
            </span>
          </div>
        </div>
        {error && (
          <div role="alert" className="error-banner">
            <span>{error}</span>
            <button onClick={() => refreshRef.current()}>重试</button>
          </div>
        )}
        {notice && (
          <div role="alert" className="error-banner">
            <span>{notice}</span>
            <button onClick={() => refreshRef.current()}>重试</button>
          </div>
        )}
        {!loading && !error && bookmarks.length === 0 && (
          <div className="empty">
            <h3>还没有书签</h3>
            <p>在 Chrome 中收藏一个网页，它就会出现在这里。</p>
            <p>按 Ctrl / ⌘ + D 收藏当前网页。</p>
          </div>
        )}
        {!loading && !error && bookmarks.length > 0 && visible.length === 0 && (
          <div className="empty">
            <h3>没有找到匹配的书签</h3>
            <p>试试其他名称、域名或文件夹路径。</p>
            <button onClick={() => setQuery("")}>清空搜索</button>
          </div>
        )}
        <BookmarkGrid
          bookmarks={initialUsage.current === null ? [] : visible}
          layout={layout}
          onEdit={setEditing}
          usage={usage}
          onOpen={opened}
          onPin={(id, pinned) => void pin(id, pinned)}
          onColumnsChange={setActualColumns}
        />
        <footer className="page-footer">本地存储 · 不上传书签</footer>
      </section>
      {editing && (
        <Rename
          key={editing.id}
          bookmark={editing}
          onClose={() => setEditing(null)}
          onSaved={() => refreshRef.current()}
        />
      )}
      {settings && (
        <LayoutSettings
          layout={layout}
          actualColumns={actualColumns}
          status={status}
          onChange={(patch) => {
            change(patch);
            setSearchError("");
          }}
          onClose={closeSettings}
        />
      )}
      <PreferenceFeedback status={status} onRetry={retry} onUndo={undo} />
    </main>
  );
}
