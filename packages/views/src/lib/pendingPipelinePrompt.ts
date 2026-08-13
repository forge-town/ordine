/**
 * COD-345/COD-346 跨包契约:apps/app 首页在用户首发时把 prompt 暂存到 sessionStorage
 * 并跳转无 id 的 /canvas,这里由 AgentPanel 消费。key 必须与 apps/app 侧
 * (apps/app/src/lib/pendingPipelinePrompt.ts)保持一致,任何一侧改动都需要同步另一侧。
 */
const PENDING_PIPELINE_PROMPT_KEY = "ordine.pendingPipelinePrompt";

/** 只读预览,不消费。用于判断是否需要走自动首发流程。 */
export const peekPendingPipelinePrompt = (): string | null => {
  if (globalThis.sessionStorage === undefined) {
    return null;
  }

  return globalThis.sessionStorage.getItem(PENDING_PIPELINE_PROMPT_KEY);
};

/** 取出并删除(一次性),保证 StrictMode 双执行/刷新场景不会重复首发。 */
export const takePendingPipelinePrompt = (): string | null => {
  if (globalThis.sessionStorage === undefined) {
    return null;
  }

  const prompt = globalThis.sessionStorage.getItem(PENDING_PIPELINE_PROMPT_KEY);
  globalThis.sessionStorage.removeItem(PENDING_PIPELINE_PROMPT_KEY);

  return prompt;
};
