const PENDING_PIPELINE_PROMPT_KEY = "ordine.pendingPipelinePrompt";

export interface PendingPipelinePrompt {
  prompt: string;
  runtimeId?: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
}

export const hasPendingPipelinePrompt = (): boolean =>
  globalThis.sessionStorage !== undefined &&
  globalThis.sessionStorage.getItem(PENDING_PIPELINE_PROMPT_KEY) !== null;

export const takePendingPipelinePrompt = (): PendingPipelinePrompt | null => {
  if (globalThis.sessionStorage === undefined) {
    return null;
  }

  const stored = globalThis.sessionStorage.getItem(PENDING_PIPELINE_PROMPT_KEY);
  globalThis.sessionStorage.removeItem(PENDING_PIPELINE_PROMPT_KEY);
  if (!stored) {
    return null;
  }

  const parsedResult = Result.fromThrowable(
    (value: string) => JSON.parse(value) as Partial<PendingPipelinePrompt>,
    () => undefined,
  )(stored);
  if (parsedResult.isErr()) {
    return { prompt: stored };
  }

  const parsed = parsedResult.value;
  if (typeof parsed.prompt === "string" && parsed.prompt.trim().length > 0) {
    return {
      prompt: parsed.prompt,
      ...(typeof parsed.runtimeId === "string" && parsed.runtimeId.length > 0
        ? { runtimeId: parsed.runtimeId }
        : {}),
      ...(typeof parsed.model === "string" && parsed.model.length > 0
        ? { model: parsed.model }
        : {}),
      ...(typeof parsed.reasoningEffort === "string" && parsed.reasoningEffort.length > 0
        ? { reasoningEffort: parsed.reasoningEffort }
        : {}),
      ...(typeof parsed.speed === "string" && parsed.speed.length > 0
        ? { speed: parsed.speed }
        : {}),
    };
  }

  return null;
};
import { Result } from "neverthrow";
