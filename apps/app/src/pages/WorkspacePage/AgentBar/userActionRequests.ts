import type { JobTrace } from "@repo/schemas";

/**
 * N17-03a：解析执行器发出的用户请求标记。
 * 协议：`@@USER_ACTION::{"kind":"…","message":"…","field"?:"…"}`（promptExecutor 注入规则）。
 * nodeId 不要求执行器提供——按 trace 流中的 `@@NODE_START::<id>` 归属当前节点。
 */

export type UserActionKind = "configure-input" | "configure-output" | "provide-info";

export type UserActionRequest = {
  field?: string;
  kind: UserActionKind;
  message: string;
  nodeId?: string;
};

const USER_ACTION_MARKER = "@@USER_ACTION::";
const NODE_START_MARKER = "@@NODE_START::";
const KINDS = new Set<UserActionKind>(["configure-input", "configure-output", "provide-info"]);

type TraceLike = Pick<JobTrace, "message"> & { createdAt?: Date };

/** traces 可能新旧任一顺序（DAO 返回 desc）；归属 nodeId 需要 oldest-first。 */
const toChronological = (traces: TraceLike[]): TraceLike[] => {
  const first = traces.at(0)?.createdAt;
  const last = traces.at(-1)?.createdAt;
  if (first && last && first.getTime() > last.getTime()) {
    return [...traces].reverse();
  }

  return traces;
};

const parseUserAction = (jsonText: string, nodeId?: string): UserActionRequest | undefined => {
  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const kind = parsed.kind;
    const message = parsed.message;
    if (typeof message !== "string" || message.trim().length === 0) {
      return undefined;
    }
    if (typeof kind !== "string" || !KINDS.has(kind as UserActionKind)) {
      return undefined;
    }

    return {
      ...(typeof parsed.field === "string" ? { field: parsed.field } : {}),
      kind: kind as UserActionKind,
      message,
      ...(nodeId ? { nodeId } : {}),
    };
  } catch {
    // 坏 JSON 容错：忽略该标记，绝不让一条坏 trace 弄崩 Agent Bar。
    return undefined;
  }
};

export const buildUserActionRequests = (traces: TraceLike[]): UserActionRequest[] => {
  let currentNodeId: string | undefined;
  const byKey = new Map<string, UserActionRequest>();

  for (const trace of toChronological(traces)) {
    // @@LLM_CONTENT 大块里也可能内嵌标记，逐行扫描。
    for (const line of trace.message.split("\n")) {
      const nodeStartIndex = line.indexOf(NODE_START_MARKER);
      if (nodeStartIndex >= 0) {
        currentNodeId = line.slice(nodeStartIndex + NODE_START_MARKER.length).split("::")[0]?.trim();
        continue;
      }

      const markerIndex = line.indexOf(USER_ACTION_MARKER);
      if (markerIndex < 0) {
        continue;
      }

      const request = parseUserAction(
        line.slice(markerIndex + USER_ACTION_MARKER.length).trim(),
        currentNodeId,
      );
      if (request) {
        // 同节点同 kind 去重，时间序后者覆盖前者（保留最新表述）。
        byKey.set(`${request.nodeId ?? ""}:${request.kind}`, request);
      }
    }
  }

  return [...byKey.values()];
};
