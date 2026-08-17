import { Result } from "neverthrow";

const PENDING_PIPELINE_PROMPT_KEY = "ordine.pendingPipelinePrompt";

export interface PendingPipelinePrompt {
  prompt: string;
  runtimeId?: string;
}

/**
 * 首页首条消息跳转画布前，把 prompt/runtime 暂存到 sessionStorage；
 * AgentPanel 在已保存的 Pipeline 画布挂载后取出并自动首发。
 * 一次性语义:take 即删。key 与 packages/views 侧消费方保持同名,勿单边改。
 */
export const savePendingPipelinePrompt = (prompt: string, runtimeId?: string) => {
  if (globalThis.sessionStorage === undefined) {
    return;
  }

  globalThis.sessionStorage.setItem(
    PENDING_PIPELINE_PROMPT_KEY,
    JSON.stringify({ prompt, ...(runtimeId ? { runtimeId } : {}) } satisfies PendingPipelinePrompt),
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
    };
  }

  return null;
};
