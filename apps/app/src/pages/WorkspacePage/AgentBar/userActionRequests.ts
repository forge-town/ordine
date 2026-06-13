import { Result } from "neverthrow";
import {
  TRACE_MARKER,
  UserActionPayloadSchema,
  type JobTrace,
  type UserActionKind,
} from "@repo/schemas";

/**
 * N17-03a：解析执行器发出的用户请求标记。
 * 标记常量与负载 schema 的唯一真相在 `@repo/schemas` 的 trace-protocol（H1-01）；
 * nodeId 不要求执行器提供——按 trace 流中的 NODE_START 标记归属当前节点。
 */

export type { UserActionKind };

export type UserActionRequest = {
  field?: string;
  kind: UserActionKind;
  message: string;
  nodeId?: string;
};

const USER_ACTION_MARKER = TRACE_MARKER.userAction;
const NODE_START_MARKER = TRACE_MARKER.nodeStart;

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
  // 坏 JSON 容错：JSON.parse 用 neverthrow 包裹，失败即忽略该标记，绝不弄崩 Agent Bar。
  const jsonResult = Result.fromThrowable(
    () => JSON.parse(jsonText) as unknown,
    () => undefined,
  )();
  if (jsonResult.isErr()) {
    return undefined;
  }
  const parsed = UserActionPayloadSchema.safeParse(jsonResult.value);
  if (!parsed.success) {
    return undefined;
  }

  return {
    ...(parsed.data.field !== undefined ? { field: parsed.data.field } : {}),
    kind: parsed.data.kind,
    message: parsed.data.message,
    ...(nodeId ? { nodeId } : {}),
  };
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
