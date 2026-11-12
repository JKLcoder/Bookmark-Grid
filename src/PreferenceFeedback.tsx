import {
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import type { SaveStatus } from "./usePreferences";
export function SaveBadge({
  status,
  loading = false,
  live = false,
}: {
  status: SaveStatus;
  loading?: boolean;
  live?: boolean;
}) {
  const Icon =
    status.phase === "error"
      ? ExclamationTriangleIcon
      : status.phase === "saving" || loading
        ? ClockIcon
        : CheckIcon;
  const label = loading
    ? "正在读取…"
    : status.phase === "error"
      ? "更改未保存"
      : status.phase === "saving"
        ? "保存中…"
        : "已保存到本机";
  return (
    <span
      className={live ? "save-indicator" : "status"}
      data-state={status.phase}
      role={live ? "status" : undefined}
      aria-live={live ? "polite" : undefined}
    >
      <Icon aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
export function PreferenceFeedback({
  status,
  onRetry,
  onUndo,
}: {
  status: SaveStatus;
  onRetry: () => void;
  onUndo: () => void;
}) {
  if (status.phase !== "error") return null;
  return (
    <div className="toast error-toast" role="alert">
      <div className="toast-title">
        <ExclamationTriangleIcon aria-hidden="true" />
        更改尚未保存
      </div>
      <p>{status.error}。当前仍在预览新设置。</p>
      <div className="toast-actions">
        <button className="primary" type="button" onClick={onRetry}>
          重试保存
        </button>
        <button type="button" onClick={onUndo}>
          撤销未保存更改
        </button>
      </div>
    </div>
  );
}
