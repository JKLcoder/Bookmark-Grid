import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Cross2Icon, GearIcon } from "@radix-ui/react-icons";
import SearchBar, { type SearchMode } from "./SearchBar";
import { searchWithEngine, ENGINE_NAMES } from "./engine-search";
import BookmarkGrid, { type BookmarkFocusRequest } from "./BookmarkGrid";
import LayoutSettings from "./LayoutSettings";
import { loadLayout } from "./layout";
import { loadUsage, recordOpen, setPinned, type UsageMap } from "./usage";
import { usePreferences } from "./usePreferences";
import { SaveBadge, PreferenceFeedback } from "./PreferenceFeedback";
import { rankBookmarks } from "./ranking";
import { loadBookmarks, saveName, subscribe, removeBookmark } from "./api";
import { displayName, searchBookmarks, type Bookmark } from "./bookmarks";

function Modal({
  title,
  onClose,
  children,
  busy = false,
  initialFocus,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    ref.current?.showModal();
    initialFocus?.current?.focus();
  }, [initialFocus]);
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
function DeleteConfirmation({
  bookmark,
  onClose,
  onDeleted,
}: {
  bookmark: Bookmark;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);
  async function remove() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await removeBookmark(bookmark.id);
      onDeleted();
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除失败，请重试。");
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      title="确认删除书签"
      onClose={onClose}
      busy={busy}
      initialFocus={cancelButton}
    >
      <p>此操作会删除 Chrome 书签管理器中的原始书签，无法在本插件内撤销。</p>
      <p className="delete-bookmark-name">{displayName(bookmark)}</p>
      <p className="delete-bookmark-url">{bookmark.url}</p>
      <p className="muted">仅删除此条书签，同网址的其他书签不受影响。</p>
      {error && (
        <p role="alert" className="error">
          删除失败：{error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          ref={cancelButton}
          type="button"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          取消删除
        </button>
        <button
          type="button"
          className="danger"
          disabled={busy}
          onClick={() => void remove()}
        >
          {busy ? "删除中…" : "确认删除"}
        </button>
      </div>
    </Modal>
  );
}
function Rename({
  bookmark,
  onClose,
  onSaved,
  onDeleted,
}: {
  bookmark: Bookmark;
  onClose: () => void;
  onSaved: (name: string) => void;
  onDeleted: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(bookmark.customName ?? bookmark.title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(value: string) {
    setSaving(true);
    setError("");
    try {
      await saveName(bookmark.id, value);
      onSaved(value.trim());
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请重试。");
      setSaving(false);
    }
  }
  if (confirming)
    return (
      <DeleteConfirmation
        bookmark={bookmark}
        onClose={() => setConfirming(false)}
        onDeleted={() => {
          onDeleted();
          onClose();
        }}
      />
    );
  return (
    <Modal
      title="编辑显示名称"
      onClose={onClose}
      busy={saving}
      initialFocus={nameInput}
    >
      <p className="muted">
        同一完整网址的书签共享显示名称，不更改 Chrome 原始标题。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save(name);
        }}
      >
        <label htmlFor="display-name">显示名称</label>
        <input
          id="display-name"
          ref={nameInput}
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
      <div className="delete-entry">
        <button
          type="button"
          className="danger-text"
          disabled={saving}
          onClick={() => setConfirming(true)}
        >
          删除书签
        </button>
      </div>
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
  const [focusRequest, setFocusRequest] = useState<BookmarkFocusRequest | null>(null);
  const [pinFeedback, setPinFeedback] = useState<{
    id: string;
    name: string;
    pinned: boolean;
    restoreFocus: boolean;
  } | null>(null);
  const viewPinButton = useRef<HTMLButtonElement>(null);
  function focusBookmark(id: string, control: BookmarkFocusRequest["control"]) {
    setFocusRequest((previous) => ({ id, control, sequence: (previous?.sequence ?? 0) + 1 }));
  }
  useLayoutEffect(() => {
    if (pinFeedback?.restoreFocus && document.activeElement === document.body) {
      viewPinButton.current?.focus({ preventScroll: true });
    }
  }, [pinFeedback]);
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
  const visible = searchBookmarks(
    rankBookmarks(bookmarks, snapshot, usage),
    mode === "bookmarks" ? query : "",
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
    const restoreFocus = document.activeElement?.classList.contains("pin-button") ?? false;
    const bookmark = bookmarks.find((bookmark) => bookmark.id === id);
    setPinFeedback(null);
    try {
      await setPinned(id, pinned);
      setUsage((previous) => ({
        ...previous,
        ...Object.fromEntries(bookmarks.filter((item) => item.url === bookmark?.url).map((item) => [item.id, {
          count: previous[item.id]?.count ?? 0,
          lastOpened: previous[item.id]?.lastOpened ?? 0,
          pinned,
        }])),
      }));
      if (bookmark) setPinFeedback({ id, name: displayName(bookmark), pinned, restoreFocus });
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
            setPinFeedback(null);
            setSearchError("");
          }}
          onQueryChange={(value) => {
            setQuery(value);
            setPinFeedback(null);
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
            {pinFeedback ? (
              <div className="pin-feedback">
                <span role="status" aria-live="polite">
                  <span className="sr-only">{pinFeedback.name}：</span>
                  {pinFeedback.pinned ? "已置顶" : "已取消置顶"}
                </span>
                <button
                  ref={viewPinButton}
                  type="button"
                  aria-label={pinFeedback.pinned ? "查看已置顶书签" : "查看已取消置顶书签"}
                  onClick={() => focusBookmark(pinFeedback.id, "pin")}
                >
                  查看
                </button>
              </div>
            ) : (
              <>
                <span
                  className="sort-copy"
                  title="置顶优先，其余按网站聚合；网站按总打开次数排序，网站内按单条使用频率排序。频率在下次打开或刷新时更新。"
                >
                  置顶优先 · 同站聚合
                </span>
                <span className="shortcut">
                  <kbd>/</kbd>定位搜索
                </span>
              </>
            )}
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
        <BookmarkGrid
          focusRequest={focusRequest}
          pageKey={mode === "bookmarks" ? query : ""}
          bookmarks={initialUsage.current === null ? [] : visible}
          layout={layout}
          onEdit={setEditing}
          usage={usage}
          onOpen={opened}
          onPin={(id, pinned) => void pin(id, pinned)}
          onColumnsChange={setActualColumns}
        >
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
        </BookmarkGrid>
        <PreferenceFeedback status={status} onRetry={retry} onUndo={undo} />
        <footer className="page-footer">本地计数 · 设置可跨设备同步</footer>
      </section>
      {editing && (
        <Rename
          key={editing.id}
          bookmark={editing}
          onClose={() => {
            setEditing(null);
            focusBookmark(editing.id, "edit");
          }}
          onSaved={(name) => {
            // Apply the acknowledged name before restoring focus to its sorted page.
            setBookmarks((previous) => previous.map((bookmark) =>
              bookmark.url === editing.url ? { ...bookmark, customName: name || undefined } : bookmark,
            ));
            refreshRef.current();
          }}
          onDeleted={() => {
            setBookmarks((previous) =>
              previous.filter((bookmark) => bookmark.id !== editing.id),
            );
            refreshRef.current();
          }}
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
    </main>
  );
}
