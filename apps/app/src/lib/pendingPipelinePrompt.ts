const PENDING_PIPELINE_PROMPT_KEY = "ordine.pendingPipelinePrompt";

/**
 * COD-345:首页首条消息跳转无 id 的 /canvas 前,把 prompt 暂存到 sessionStorage;
 * COD-346 的 AgentPanel 在 CanvasPage 挂载后取出并自动首发。
 * 一次性语义:take 即删。key 与 packages/views 侧消费方保持同名,勿单边改。
 */
export const savePendingPipelinePrompt = (prompt: string) => {
  if (globalThis.sessionStorage === undefined) {
    return;
  }

  globalThis.sessionStorage.setItem(PENDING_PIPELINE_PROMPT_KEY, prompt);
};

export const takePendingPipelinePrompt = (): string | null => {
  if (globalThis.sessionStorage === undefined) {
    return null;
  }

  const prompt = globalThis.sessionStorage.getItem(PENDING_PIPELINE_PROMPT_KEY);
  globalThis.sessionStorage.removeItem(PENDING_PIPELINE_PROMPT_KEY);

  return prompt;
};
