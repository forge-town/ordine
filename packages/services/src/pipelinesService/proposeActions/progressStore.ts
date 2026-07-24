/**
 * Coarse-grained stage events for proposeActions (in-memory).
 * Stages are only written at real call boundaries (entering the analyzing /
 * drafting / validating phases) and the frontend polls them — no timer ever
 * fakes progress. Single-process memory is sufficient: in dev/local mode the
 * tRPC handler and the execution share one process; entries carry a TTL to
 * avoid leaks.
 */

export type ProposeProgressStage = "thinking" | "analyzing" | "drafting" | "validating" | "done";

type ProgressEntry = {
  stage: ProposeProgressStage;
  updatedAt: number;
};

const TTL_MS = 5 * 60_000;
const store = new Map<string, ProgressEntry>();

const evictExpired = () => {
  const now = Date.now();
  for (const [token, entry] of store) {
    if (now - entry.updatedAt > TTL_MS) {
      store.delete(token);
    }
  }
};

export const setProposeProgress = (token: string, stage: ProposeProgressStage): void => {
  evictExpired();
  store.set(token, { stage, updatedAt: Date.now() });
};

export const getProposeProgress = (token: string): ProposeProgressStage | null => {
  evictExpired();

  return store.get(token)?.stage ?? null;
};

/** Test-only reset. */
export const clearProposeProgressStore = (): void => {
  store.clear();
};
