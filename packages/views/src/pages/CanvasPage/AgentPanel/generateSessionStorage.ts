/**
 * 空画布 generate 会话的 sessionStorage 暂存。
 * generate 会话消息只存在于服务端 session 里(不写入 conversationMessages),
 * 刷新后凭这里暂存的 sessionId 恢复对话;会话绑定到新建 pipeline 后即清除。
 */
const GENERATE_SESSION_ID_KEY = "ordine.canvasAgentGenerateSessionId";

export const saveGenerateSessionId = (sessionId: string) => {
  if (globalThis.sessionStorage === undefined) {
    return;
  }

  globalThis.sessionStorage.setItem(GENERATE_SESSION_ID_KEY, sessionId);
};

export const loadGenerateSessionId = (): string | null => {
  if (globalThis.sessionStorage === undefined) {
    return null;
  }

  return globalThis.sessionStorage.getItem(GENERATE_SESSION_ID_KEY);
};

export const clearGenerateSessionId = () => {
  if (globalThis.sessionStorage === undefined) {
    return;
  }

  globalThis.sessionStorage.removeItem(GENERATE_SESSION_ID_KEY);
};
