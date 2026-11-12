import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Pencil1Icon,
  DrawingPinIcon,
  DrawingPinFilledIcon,
} from "@radix-ui/react-icons";
import Favicon from "./Favicon";
import { displayName, type Bookmark } from "./bookmarks";
import { resolveColumns, type Layout } from "./layout";
import type { UsageMap } from "./usage";
interface Props {
  bookmarks: Bookmark[];
  layout: Layout;
  usage: UsageMap;
  onEdit: (bookmark: Bookmark) => void;
  onOpen: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
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
}: Props) {
  const ref = useRef<HTMLUListElement>(null);
  const [geometry, setGeometry] = useState(() => ({
    width: Math.max(0, window.innerWidth - 64),
    coarse: window.matchMedia?.("(hover:none)").matches ?? false,
  }));
  useEffect(() => {
    const media = window.matchMedia?.("(hover:none)");
    const measure = () => {
      const next = {
        width:
          ref.current?.getBoundingClientRect().width ||
          Math.max(0, window.innerWidth - 64),
        coarse: media?.matches ?? false,
      };
      setGeometry((previous) =>
        previous.width === next.width && previous.coarse === next.coarse
          ? previous
          : next,
      );
    };
    measure();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    if (ref.current) observer?.observe(ref.current);
    window.addEventListener("resize", measure);
    media?.addEventListener("change", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      media?.removeEventListener("change", measure);
    };
  }, []);
  const columns = resolveColumns(
    layout.columns,
    geometry.width,
    layout.columnGap,
    layout.itemSize,
    geometry.coarse,
  );
  useEffect(() => onColumnsChange?.(columns), [columns, onColumnsChange]);
  return (
    <ul
      ref={ref}
      className="bookmark-grid"
      style={
        {
          gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
          rowGap: layout.rowGap,
          columnGap: layout.columnGap,
          "--item-size": `${layout.itemSize}px`,
        } as CSSProperties
      }
    >
      {bookmarks.map((bookmark) => {
        const pinned = usage[bookmark.id]?.pinned === true;
        return (
          <li
            key={bookmark.id}
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
  );
}
