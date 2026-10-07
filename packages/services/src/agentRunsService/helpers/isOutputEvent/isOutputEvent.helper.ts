import type { RuntimeEvent } from "@repo/schemas";

export const isOutputEvent = (event: RuntimeEvent): boolean =>
  event.type === "text_delta" ||
  event.type === "message" ||
  event.type === "thinking_delta" ||
  event.type === "thinking" ||
  event.type === "tool_start" ||
  event.type === "tool_update" ||
  event.type === "tool_result";
