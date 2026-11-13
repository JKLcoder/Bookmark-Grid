import SyncSettings from "./SyncSettings";
import { useEffect, useRef } from "react";
import { Cross2Icon } from "@radix-ui/react-icons";
import { DEFAULT_LAYOUT, type Layout } from "./layout";
import { SaveBadge } from "./PreferenceFeedback";
import type { SaveStatus } from "./usePreferences";
interface Props {
  layout: Layout;
  actualColumns: number;
  status: SaveStatus;
  onChange: (patch: Partial<Layout>) => void;
  onClose: (restoreFocus?: boolean) => void;
}
export default function LayoutSettings({
  layout,
  actualColumns,
  status,
  onChange,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("select")?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(true);
        return;
      }
      if (
        event.key === "Tab" &&
        ref.current?.contains(document.activeElement)
      ) {
        const controls = [
          ...ref.current.querySelectorAll<HTMLElement>(
            "button:not([disabled]),select:not([disabled]),input:not([disabled]):not([hidden])",
          ),
        ];
        if (
          (event.shiftKey && document.activeElement === controls[0]) ||
          (!event.shiftKey && document.activeElement === controls.at(-1))
        ) {
          event.preventDefault();
          onClose(true);
        }
      }
    }
    function outside(event: PointerEvent | FocusEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target &&
        !ref.current?.contains(target) &&
        !target.closest("[data-settings-trigger]")
      )
        onClose(false);
    }
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
    };
  }, [onClose]);
  const requested = layout.columns === "auto" ? "自动" : `${layout.columns} 列`;
  return (
    <div
      ref={ref}
      className="layout-settings"
      role="dialog"
      aria-modal="false"
      aria-labelledby="layout-title"
      id="layout-settings"
    >
      <div className="panel-heading">
        <h2 id="layout-title">页面设置</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="关闭设置"
          onClick={() => onClose(true)}
        >
          <Cross2Icon />
        </button>
      </div>
      <section
        className="settings-section"
        aria-labelledby="layout-section-title"
      >
        <div className="section-header">
          <h3 id="layout-section-title">网格布局</h3>
          <button
            type="button"
            onClick={() =>
              onChange({
                columns: DEFAULT_LAYOUT.columns,
                rowGap: DEFAULT_LAYOUT.rowGap,
                columnGap: DEFAULT_LAYOUT.columnGap,
                itemSize: DEFAULT_LAYOUT.itemSize,
              })
            }
          >
            恢复布局默认
          </button>
        </div>
        <div className="setting-row">
          <label htmlFor="columns">期望列数</label>
          <select
            id="columns"
            value={layout.columns}
            onChange={(e) =>
              onChange({
                columns:
                  e.target.value === "auto" ? "auto" : Number(e.target.value),
              })
            }
          >
            <option value="auto">自动</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} 列
              </option>
            ))}
          </select>
        </div>
        <p className="actual-columns" aria-live="polite">
          {layout.columns === "auto"
            ? `自动布局：当前显示 ${actualColumns} 列。`
            : actualColumns === layout.columns
              ? `当前显示 ${actualColumns} 列。`
              : `已选择 ${requested}，当前显示 ${actualColumns} 列。已按字号和窗口宽度保护名称可读性。`}
        </p>
        {(["rowGap", "columnGap"] as const).map((field) => (
          <div className="setting-row" key={field}>
            <label htmlFor={field}>
              {field === "rowGap" ? "行间距" : "列间距"}
            </label>
            <input
              id={field}
              type="range"
              min="0"
              max={field === "rowGap" ? 32 : 48}
              step="1"
              value={layout[field]}
              onChange={(e) => onChange({ [field]: Number(e.target.value) })}
            />
            <output htmlFor={field}>{layout[field]} px</output>
          </div>
        ))}
        <div className="setting-row">
          <label htmlFor="itemSize">文字与图标</label>
          <input
            id="itemSize"
            aria-label="文字与图标大小"
            type="range"
            min="12"
            max="28"
            step="1"
            value={layout.itemSize}
            onChange={(e) => onChange({ itemSize: Number(e.target.value) })}
          />
          <output htmlFor="itemSize">{layout.itemSize} px</output>
        </div>
        <p className="helper">
          文字与网站图标保持等大。字号变大时会自动减少列数，让名称保留足够的阅读空间。
        </p>
      </section>
      <section
        className="settings-section"
        aria-labelledby="behavior-section-title"
      >
        <div className="section-header">
          <h3 id="behavior-section-title">搜索与打开</h3>
          <button
            type="button"
            onClick={() =>
              onChange({
                searchEngine: DEFAULT_LAYOUT.searchEngine,
                openInNewTab: DEFAULT_LAYOUT.openInNewTab,
              })
            }
          >
            恢复此组默认
          </button>
        </div>
        <div className="setting-row">
          <label htmlFor="search-engine">网页搜索引擎</label>
          <select
            id="search-engine"
            value={layout.searchEngine}
            onChange={(e) =>
              onChange({
                searchEngine: e.target.value as Layout["searchEngine"],
              })
            }
          >
            <option value="browser">跟随 Chrome</option>
            <option value="baidu">百度</option>
            <option value="google">Google</option>
          </select>
        </div>
        <div className="setting-row">
          <label htmlFor="open-mode">书签打开方式</label>
          <select
            id="open-mode"
            value={layout.openInNewTab ? "new" : "current"}
            onChange={(e) =>
              onChange({ openInNewTab: e.target.value === "new" })
            }
          >
            <option value="current">当前标签页</option>
            <option value="new">新标签页</option>
          </select>
        </div>
        <p className="helper">此项仅影响书签。搜索结果仍在当前标签页打开。</p>
      </section>
      <SyncSettings />
      <div className="settings-footer">
        <span>设置自动保存到本机</span>
        <SaveBadge status={status} />
      </div>
    </div>
  );
}
