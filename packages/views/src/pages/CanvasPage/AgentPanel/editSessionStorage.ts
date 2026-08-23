const EDIT_SESSION_KEY_PREFIX = "ordine.canvasAgentEditSession.";

type StoredEditSession = {
  graphSignature: string;
  sessionId: string;
};

const storageKey = (pipelineId: string) => `${EDIT_SESSION_KEY_PREFIX}${pipelineId}`;

export const saveEditSession = (pipelineId: string, session: StoredEditSession) => {
  if (globalThis.sessionStorage === undefined) return;
  globalThis.sessionStorage.setItem(storageKey(pipelineId), JSON.stringify(session));
};

export const loadEditSession = (pipelineId: string): StoredEditSession | null => {
  if (globalThis.sessionStorage === undefined) return null;
  const raw = globalThis.sessionStorage.getItem(storageKey(pipelineId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredEditSession>;
    if (typeof parsed.graphSignature !== "string" || typeof parsed.sessionId !== "string") {
      return null;
    }

    return { graphSignature: parsed.graphSignature, sessionId: parsed.sessionId };
  } catch {
    return null;
  }
};

export const clearEditSession = (pipelineId: string) => {
  if (globalThis.sessionStorage === undefined) return;
  globalThis.sessionStorage.removeItem(storageKey(pipelineId));
};
