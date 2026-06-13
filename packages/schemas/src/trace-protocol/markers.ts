/**
 * 运行期结构化 trace 标记的唯一定义源（H1-01）。
 *
 * 这些 `@@…::` 标记由 pipeline-engine（及 promptExecutor 教执行器）写入 job_traces，
 * 前端 RunConsole / runSummary / userActionRequests 解析后驱动 UI。
 * 生产端与解析端**必须**只引用本文件的常量与编码函数，禁止再写裸字面量。
 */

/** 所有结构化标记共享的前缀。 */
export const TRACE_MARKER_PREFIX = "@@";

/**
 * 各标记的完整前缀（含尾部 `::`）。生产端总是以 `<prefix><payload>` 形式输出，
 * 故解析端用 `startsWith(TRACE_MARKER.x)` 与 `split("::")` 均与历史行为字节级一致。
 */
export const TRACE_MARKER = {
  checkpointResume: "@@CHECKPOINT_RESUME::",
  checkpointWait: "@@CHECKPOINT_WAIT::",
  edgeConditionSkip: "@@EDGE_CONDITION_SKIP::",
  edgeQualitySkip: "@@EDGE_QUALITY_SKIP::",
  llmContent: "@@LLM_CONTENT::",
  nodeDone: "@@NODE_DONE::",
  nodeFail: "@@NODE_FAIL::",
  nodeSkipped: "@@NODE_SKIPPED::",
  nodeStart: "@@NODE_START::",
  runPause: "@@RUN_PAUSE::",
  runResume: "@@RUN_RESUME::",
  selfHeal: "@@SELF_HEAL::",
  selfHealDone: "@@SELF_HEAL_DONE::",
  userAction: "@@USER_ACTION::",
} as const;

export type TraceMarkerKey = keyof typeof TRACE_MARKER;

/** 节点生命周期标记（payload 为 nodeId）。 */
export const encodeNodeStart = (nodeId: string): string => `${TRACE_MARKER.nodeStart}${nodeId}`;
export const encodeNodeDone = (nodeId: string): string => `${TRACE_MARKER.nodeDone}${nodeId}`;
export const encodeNodeFail = (nodeId: string): string => `${TRACE_MARKER.nodeFail}${nodeId}`;
export const encodeNodeSkipped = (nodeId: string, reason: string): string =>
  `${TRACE_MARKER.nodeSkipped}${nodeId}::${reason}`;

/** LLM 流式内容标记（payload 为 nodeId + 文本）。 */
export const encodeLlmContent = (nodeId: string, content: string): string =>
  `${TRACE_MARKER.llmContent}${nodeId}::${content}`;

/** 自愈标记。 */
export const encodeSelfHeal = (nodeId: string, attempt: number, detail: string): string =>
  `${TRACE_MARKER.selfHeal}${nodeId}::${attempt}::${detail}`;
export const encodeSelfHealDone = (nodeId: string, attempt: number): string =>
  `${TRACE_MARKER.selfHealDone}${nodeId}::${attempt}`;

/** 运行控制标记。 */
export const encodeRunPause = (nodeId: string): string => `${TRACE_MARKER.runPause}${nodeId}`;
export const encodeRunResume = (nodeId: string): string => `${TRACE_MARKER.runResume}${nodeId}`;
export const encodeCheckpointWait = (nodeId: string): string =>
  `${TRACE_MARKER.checkpointWait}${nodeId}`;
export const encodeCheckpointResume = (nodeId: string): string =>
  `${TRACE_MARKER.checkpointResume}${nodeId}`;

/** 边跳过标记。 */
export const encodeEdgeConditionSkip = (edgeId: string, expression: string): string =>
  `${TRACE_MARKER.edgeConditionSkip}${edgeId}::${expression}`;
export const encodeEdgeQualitySkip = (edgeId: string, criteria: string): string =>
  `${TRACE_MARKER.edgeQualitySkip}${edgeId}::${criteria}`;
