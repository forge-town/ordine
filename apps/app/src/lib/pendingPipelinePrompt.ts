import { Result } from "neverthrow";
import type { AgentExecutionChoice } from "@repo/schemas";

const PENDING_PIPELINE_PROMPT_KEY = "ordine.pendingPipelinePrompt";

export interface PendingPipelinePrompt {
  prompt: string;
  runtimeId?: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
}

/**
 * 首页首条消息跳转画布前，把 prompt/runtime 暂存到 sessionStorage；
 * AgentPanel 在已保存的 Pipeline 画布挂载后取出并自动首发。
 * 一次性语义:take 即删。key 与 packages/views 侧消费方保持同名,勿单边改。
 */
export const savePendingPipelinePrompt = (
  prompt: string,
  executionChoice?: AgentExecutionChoice | null,
) => {
  if (globalThis.sessionStorage === undefined) {
    return;
  }

  globalThis.sessionStorage.setItem(
    PENDING_PIPELINE_PROMPT_KEY,
    JSON.stringify({
      prompt,
      ...(executionChoice
        ? {
            runtimeId: executionChoice.runtimeConfigId,
            ...(executionChoice.model ? { model: executionChoice.model } : {}),
            ...(executionChoice.reasoningEffort
              ? { reasoningEffort: executionChoice.reasoningEffort }
              : {}),
            ...(executionChoice.speed ? { speed: executionChoice.speed } : {}),
          }
        : {}),
    } satisfies PendingPipelinePrompt),
  );
};

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
    // Backward compatibility for prompts saved by COD-345 before the runtime was included.
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
