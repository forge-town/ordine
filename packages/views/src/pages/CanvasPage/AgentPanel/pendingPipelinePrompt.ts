const PENDING_PIPELINE_PROMPT_KEY = "ordine.pendingPipelinePrompt";

export interface PendingPipelinePrompt {
  prompt: string;
  runtimeId?: string;
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

  try {
    const parsed = JSON.parse(stored) as Partial<PendingPipelinePrompt>;
    if (typeof parsed.prompt === "string" && parsed.prompt.trim().length > 0) {
      return {
        prompt: parsed.prompt,
        ...(typeof parsed.runtimeId === "string" && parsed.runtimeId.length > 0
          ? { runtimeId: parsed.runtimeId }
          : {}),
      };
    }
  } catch {
    return { prompt: stored };
  }

  return null;
};
