/**
 * 全站共享的展示格式化函数（G1-01）。
 * 此前 formatDuration/formatCost/timeAgo 在 6 个组件里各有一份实现且格式不一致
 * （"41.3s" vs "41s" vs "1m02s"）——本模块是唯一允许的实现处。
 */

type TimeInput = Date | string | number | null | undefined;

const toMs = (value: TimeInput): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isNaN(ms) ? null : ms;
};

/** 时长（毫秒）→ "320ms" / "41.3s" / "1m02s"。空值返回 fallback（默认 "—"）。 */
export const formatDurationMs = (ms: number | null | undefined, fallback = "—"): string => {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return fallback;
  const clamped = Math.max(0, ms);
  if (clamped < 1000) return `${Math.round(clamped)}ms`;
  const seconds = clamped / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  return `${Math.floor(seconds / 60)}m${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
};

/** 起止时间 → 时长；end 为空用当前时间（运行中）。start 为空返回 fallback。 */
export const formatDurationBetween = (
  start: TimeInput,
  end: TimeInput = null,
  fallback = "—",
): string => {
  const startMs = toMs(start);
  if (startMs === null) return fallback;

  return formatDurationMs((toMs(end) ?? Date.now()) - startMs, fallback);
};

/** 成本 → "$0.31"；非法/非正数返回 null（调用方自行 `?? "—"`）。 */
export const formatCost = (value: number | string | null | undefined): string | null => {
  const cost = typeof value === "string" ? Number(value) : value;
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost <= 0) return null;

  return `$${cost.toFixed(2)}`;
};

/** token 用量 → "1200 → 480"；双空返回 "—"。 */
export const formatTokens = (input: number | null, output: number | null): string => {
  if (input === null && output === null) return "—";

  return `${input ?? 0} → ${output ?? 0}`;
};

/** 相对时间（紧凑、无文案词）→ "now" / "45s" / "5m" / "3h" / "2d"。 */
export const timeAgo = (value: TimeInput): string => {
  const ms = toMs(value);
  if (ms === null) return "—";
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 5) return "now";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);

  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
