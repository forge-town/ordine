/**
 * N15-01 · proposeActions 粗粒度阶段事件（内存态）。
 * 阶段只在真实调用边界写入（进入分析/起草/校验时），前端轮询读取——
 * 没有任何定时器伪造的推进（手册警告 4）。单进程内存即可：
 * dev/local 模式下 tRPC 与执行同进程；条目带 TTL 防泄漏。
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

/** 仅供单测重置。 */
export const clearProposeProgressStore = (): void => {
  store.clear();
};
