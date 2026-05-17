import { Bot, Clock, CheckCircle2, XCircle, Wrench, MessageSquare, Code2 } from "lucide-react";
import type { SpanType, SpanStatus } from "@repo/schemas";

export const formatDuration = (ms: number | null): string => {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;

  return `${(ms / 1000).toFixed(2)}s`;
};

export const formatTokens = (input: number | null, output: number | null): string => {
  if (input === null && output === null) return "—";

  return `${input ?? 0} → ${output ?? 0}`;
};

export const SPAN_TYPE_ICON: Record<SpanType, React.ElementType> = {
  agent_run: Bot,
  llm_call: MessageSquare,
  tool_call: Wrench,
  tool_result: Code2,
};

export const SPAN_STATUS_STYLE: Record<SpanStatus, { cls: string; icon: React.ElementType }> = {
  running: { cls: "text-blue-600", icon: Clock },
  completed: { cls: "text-emerald-600", icon: CheckCircle2 },
  error: { cls: "text-red-600", icon: XCircle },
};
