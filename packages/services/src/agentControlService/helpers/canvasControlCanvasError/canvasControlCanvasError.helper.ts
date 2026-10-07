import type { CanvasControlError } from "../canvasControl";

export const canvasError = (
  actionId: string,
  code: string,
  message: string,
  retryable = true,
  extras: Pick<CanvasControlError, "field" | "nodeId" | "portId"> = {},
): CanvasControlError => ({ actionId, code, message, retryable, ...extras });
