import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Pencil1Icon,
  DrawingPinIcon,
  DrawingPinFilledIcon,
} from "@radix-ui/react-icons";
import Favicon from "./Favicon";
import { displayName, type Bookmark } from "./bookmarks";
import { resolveColumns, type Layout } from "./layout";
import type { UsageMap } from "./usage";
export type BookmarkFocusRequest = {
  id: string;
  control: "edit" | "pin";
  sequence: number;
};
interface Props {
  bookmarks: Bookmark[];
  layout: Layout;
  usage: UsageMap;
  onEdit: (bookmark: Bookmark) => void;
  onOpen: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  pageKey?: string;
  focusRequest?: BookmarkFocusRequest | null;
  children?: ReactNode;
  onColumnsChange?: (columns: number) => void;
}
export default function BookmarkGrid({
  bookmarks,
  layout,
  onEdit,
  usage,
  onOpen,
  onPin,
  onColumnsChange,
  pageKey = "",
  focusRequest,
  children,
}: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const completedFocus = useRef(0);
  const [position, setPosition] = useState({ key: "", page: 0 });
  const [geometry, setGeometry] = useState(() => ({
    height: 0,
    rowHeight: 46,
    width: Math.max(0, window.innerWidth - 64),
    coarse: window.matchMedia?.("(hover:none)").matches ?? false,
  }));
  useLayoutEffect(() => {
    const media = window.matchMedia?.("(hover:none)");
    const measure = () => {
      const next = {
        height: viewport.current?.getBoundingClientRect().height ?? 0,
        rowHeight:
          ref.current?.firstElementChild?.getBoundingClientRect().height ||
          Math.max(44, layout.itemSize * 1.5 + 16) + 2,
        width:
          ref.current?.getBoundingClientRect().width ||
          Math.max(0, window.innerWidth - 64),
        coarse: media?.matches ?? false,
      };
      setGeometry((previous) =>
        previous.width === next.width &&
        previous.height === next.height &&
        previous.rowHeight === next.rowHeight &&
        previous.coarse === next.coarse
          ? previous
          : next,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (viewport.current) observer?.observe(viewport.current);
    if (ref.current) observer?.observe(ref.current);
    window.addEventListener("resize", measure);
    media?.addEventListener("change", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      media?.removeEventListener("change", measure);
    };
  }, [layout.itemSize, bookmarks.length > 0]);
  const columns = resolveColumns(
    layout.columns,
    geometry.width,
    layout.columnGap,
    layout.itemSize,
    geometry.coarse,
  );
  useEffect(() => onColumnsChange?.(columns), [columns, onColumnsChange]);
  const rows = Math.max(
    1,
    Math.floor((geometry.height + layout.rowGap) / (geometry.rowHeight + layout.rowGap)),
  );
  const pageSize = rows * columns;
  const pageCount = Math.max(1, Math.ceil(bookmarks.length / pageSize));
  // A search or capacity change starts at the beginning; refreshed data only clamps.
  const key = JSON.stringify([pageKey, pageSize]);
  const page = position.key === key ? Math.min(position.page, pageCount - 1) : 0;
  if (position.key !== key || position.page !== page) {
    setPosition({ key, page });
  }
  useLayoutEffect(() => {
    if (!focusRequest || completedFocus.current === focusRequest.sequence) return;
    const index = bookmarks.findIndex((bookmark) => bookmark.id === focusRequest.id);
    const targetPage = index < 0 ? page : Math.floor(index / pageSize);
    if (targetPage !== page) {
      setPosition({ key, page: targetPage });
      return;
    }
    const item = Array.from(ref.current?.children ?? []).find(
      (element) => (element as HTMLElement).dataset.bookmarkId === focusRequest.id,
    );
    const control = item?.querySelector<HTMLElement>(
      focusRequest.control === "edit" ? ".edit-button" : ".pin-button",
    );
    const fallback = ref.current?.querySelector<HTMLElement>(".bookmark-link")
      ?? document.getElementById("search");
    completedFocus.current = focusRequest.sequence;
    // Focusing the link first reveals controls hidden until :focus-within.
    if (control) item?.querySelector<HTMLElement>(".bookmark-link")?.focus({ preventScroll: true });
    (control ?? fallback)?.focus({ preventScroll: true });
  }, [focusRequest, bookmarks, page, pageSize, key]);
  return (
    <div className="bookmark-pages">
      <div className="bookmark-viewport" ref={viewport}>
        {children}
        <ul
          ref={ref}
          className="bookmark-grid"
          id="bookmark-grid"
          style={
            {
              gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
              rowGap: layout.rowGap,
              columnGap: layout.columnGap,
              "--item-size": `${layout.itemSize}px`,
            } as CSSProperties
          }
        >
          {bookmarks.slice(page * pageSize, (page + 1) * pageSize).map((bookmark) => {
            const pinned = usage[bookmark.id]?.pinned === true;
            return (
              <li
                key={bookmark.id}
                data-bookmark-id={bookmark.id}
                className={`bookmark-item${pinned ? " is-pinned" : ""}`}
              >
                <a
                  className="bookmark-link"
                  href={bookmark.url}
                  target={layout.openInNewTab ? "_blank" : undefined}
                  rel={layout.openInNewTab ? "noopener noreferrer" : undefined}
                  onClick={(event) => {
                    if (event.button === 0) onOpen(bookmark.id);
                  }}
                  onAuxClick={(event) => {
                    if (event.button === 1) onOpen(bookmark.id);
                  }}
                  title={`${displayName(bookmark)}\n${bookmark.folderPath.join(" / ")}`}
                >
                  <Favicon
                    key={bookmark.url}
                    url={bookmark.url}
                    size={layout.itemSize}
                  />
                  <span className="item-name">{displayName(bookmark)}</span>
                  {pinned && (
                    <span className="pin-mark" aria-hidden="true">
                      <DrawingPinFilledIcon />
                    </span>
                  )}
                </a>
                <div className="item-actions">
                  <button
                    type="button"
                    className="icon-button pin-button"
                    aria-pressed={pinned}
                    aria-label={`${pinned ? "取消置顶" : "置顶"} ${displayName(bookmark)}`}
                    title={pinned ? "取消置顶" : "置顶"}
                    onClick={() => onPin(bookmark.id, !pinned)}
                  >
                    {pinned ? <DrawingPinFilledIcon /> : <DrawingPinIcon />}
                  </button>
                  <button
                    type="button"
                    className="icon-button edit-button"
                    aria-label={`编辑 ${displayName(bookmark)}`}
                    onClick={() => onEdit(bookmark)}
                    title="编辑显示名称"
                  >
                    <Pencil1Icon />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <nav
        className="pagination"
        aria-label="书签分页"
        style={{ visibility: pageCount > 1 ? "visible" : "hidden" }}
      >
        <button
          type="button"
          aria-controls="bookmark-grid"
          disabled={page === 0}
          onClick={() => setPosition({ key, page: page - 1 })}
        >
          上一页
        </button>
        <span role="status" aria-live="polite" aria-atomic="true">
          第 {page + 1} / {pageCount} 页
        </span>
        <button
          type="button"
          aria-controls="bookmark-grid"
          disabled={page === pageCount - 1}
          onClick={() => setPosition({ key, page: page + 1 })}
        >
          下一页
        </button>
      </nav>
    </div>
  );
}
