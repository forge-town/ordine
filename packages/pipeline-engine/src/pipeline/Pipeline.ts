import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { pluginRegistry } from "@repo/plugin";
import { type NodeCtx } from "../schemas";
import {
  BUILTIN_NODE_TYPE_ENUM,
  DECISION_NODE_TYPE_ENUM,
  encodeCheckpointResume,
  encodeCheckpointWait,
  encodeEdgeConditionSkip,
  encodeEdgeQualitySkip,
  encodeNodeDone,
  encodeNodeSkipped,
  encodeNodeStart,
  encodeRunPause,
  encodeRunResume,
  encodeSelfHeal,
  encodeSelfHealDone,
  OBJECT_NODE_TYPE_ENUM,
  OPERATION_NODE_TYPE_ENUM,
  OUTPUT_NODE_TYPE_ENUM,
  type NodeRunStatus,
  type PipelineEdge,
  type PipelineEdgeData,
  type PipelineNode,
  type PipelineNodeData,
  type MetaNodeType,
} from "@repo/schemas";
import type { PipelineEngineDeps } from "../deps";
import { ScriptExecutionError, type PipelineRunError } from "../errors";
import { buildExecutionLevels, type CycleDetectedError } from "../dagScheduler";
import { safeReadInputFile } from "../infrastructure";
import type { AgentInfo, OperationInfo, SkillInfo, OperationNodeContext } from "../nodes/types";
import { processFileNode } from "../nodes/FileNode";
import { processFolderNode } from "../nodes/FolderNode";
import { processGitHubProjectNode } from "../nodes/GitHubProjectNode";
import { processPromptNode } from "../nodes/PromptNode";
import { processOutputLocalPathNode } from "../nodes/OutputLocalPathNode";
import { processOperationNode } from "../nodes/OperationNode";
import {
  processDecisionNode,
  type PipelineDecisionEvent,
  type DecisionResult,
} from "../nodes/DecisionNode";

const OBJECT_TYPES: ReadonlySet<string> = new Set(Object.values(OBJECT_NODE_TYPE_ENUM));
const OPERATION_TYPES: ReadonlySet<string> = new Set(Object.values(OPERATION_NODE_TYPE_ENUM));
const OUTPUT_TYPES: ReadonlySet<string> = new Set(Object.values(OUTPUT_NODE_TYPE_ENUM));
const DECISION_TYPES: ReadonlySet<string> = new Set(Object.values(DECISION_NODE_TYPE_ENUM));
const DEFAULT_SELF_HEAL_RETRIES = 1;

const resolveMetaType = (type: string): MetaNodeType =>
  OBJECT_TYPES.has(type)
    ? "object"
    : OPERATION_TYPES.has(type)
      ? "operation"
      : OUTPUT_TYPES.has(type)
        ? "output"
        : DECISION_TYPES.has(type)
          ? "decision"
          : "object";

const isRootNode = (node: PipelineNode): boolean =>
  typeof (node as PipelineNode & { parentId?: unknown }).parentId !== "string";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringConfig = (config: Record<string, unknown>, key: string): string | undefined =>
  typeof config[key] === "string" ? config[key] : undefined;

const evaluateConditionExpression = (expression: string, content: string): boolean => {
  const trimmed = expression.trim();
  if (!trimmed || trimmed === "true") return true;
  if (trimmed === "false") return false;

  const includesMatch = /^(?:content|output)\.includes\(["'](.+)["']\)$/.exec(trimmed);
  if (includesMatch) {
    return content.includes(includesMatch[1]!);
  }

  const notIncludesMatch = /^!(?:content|output)\.includes\(["'](.+)["']\)$/.exec(trimmed);
  if (notIncludesMatch) {
    return !content.includes(notIncludesMatch[1]!);
  }

  return content.includes(trimmed);
};

const passesQualityGate = (qualityGate: PipelineEdgeData["qualityGate"], content: string) => {
  if (!qualityGate) return true;

  const criteria = qualityGate.criteria.trim();
  if (!criteria) return true;
  if (criteria === "non-empty") return content.trim().length > 0;

  return content.includes(criteria);
};

const applyTransformStep = (content: string, step: { type: string; config: unknown }): string => {
  const config = isRecord(step.config) ? step.config : {};

  switch (step.type) {
    case "trim": {
      return content.trim();
    }
    case "uppercase": {
      return content.toUpperCase();
    }
    case "lowercase": {
      return content.toLowerCase();
    }
    case "prefix": {
      return `${stringConfig(config, "value") ?? ""}${content}`;
    }
    case "suffix": {
      return `${content}${stringConfig(config, "value") ?? ""}`;
    }
    case "replace": {
      const from = stringConfig(config, "from");
      if (!from) return content;

      return content.split(from).join(stringConfig(config, "to") ?? "");
    }
    default: {
      return content;
    }
  }
};

export type PipelineRunResult =
  | { ok: true; summary: string }
  | { ok: false; error: PipelineRunError | CycleDetectedError };

export interface PipelineDefinition {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface PipelineNodeStatusEvent {
  jobId: string;
  nodeId: string;
  status: NodeRunStatus;
}

export interface PipelineRunControlEvent {
  jobId: string;
  nodeId: string;
  reason: "checkpoint" | "pause";
}

export interface PipelineRunControl {
  shouldPauseBeforeNode?: (event: PipelineRunControlEvent) => boolean | Promise<boolean>;
  waitForResume?: (event: PipelineRunControlEvent) => Promise<void>;
  /** 决策节点挂起：返回用户选中的候选源节点 id。未提供则决策节点失败（不伪造选择）。 */
  waitForDecision?: (event: PipelineDecisionEvent) => Promise<DecisionResult>;
}

export interface PipelineOptions {
  pipeline: PipelineDefinition;
  jobId: string;
  inputPath?: string;
  githubToken?: string;
  defaultOutputPath?: string;
  operations: Map<string, OperationInfo>;
  deps: PipelineEngineDeps;
  lookupAgent: (id: string) => Promise<AgentInfo | null>;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  onNodeStatusChange?: (event: PipelineNodeStatusEvent) => Promise<void> | void;
  runControl?: PipelineRunControl;
  /** N18-05：self-heal 重试轮数（0=失败即停，不再自动重试）。 */
  selfHealRetries?: number;
}

export class Pipeline {
  private opts: PipelineOptions;
  private tempDirs: string[] = [];
  private nodeOutputs = new Map<string, NodeCtx>();
  private edgeActiveCache = new Map<string, boolean>();

  constructor(opts: PipelineOptions) {
    this.opts = opts;
  }

  async run(): Promise<PipelineRunResult> {
    this.tempDirs = [];
    this.nodeOutputs = new Map();
    this.edgeActiveCache = new Map();

    const { pipeline, jobId } = this.opts;
    const { nodes, edges } = pipeline;
    const rootNodeIds = new Set(nodes.filter(isRootNode).map((node) => node.id));
    const rootNodes = nodes.filter((node) => rootNodeIds.has(node.id));
    const rootEdges = edges.filter(
      (edge) => rootNodeIds.has(edge.source) && rootNodeIds.has(edge.target),
    );

    const levelsResult = buildExecutionLevels(rootNodes, rootEdges);
    if (levelsResult.isErr()) {
      return { ok: false, error: levelsResult.error };
    }
    const levels = levelsResult.value;

    await trace(
      jobId,
      `Pipeline "${pipeline.name}" loaded. ${rootNodes.length} top-level nodes in ${levels.length} levels.`,
    );
    for (const node of rootNodes) {
      await this.emitNodeStatus(node.id, "queued");
    }

    if (this.opts.inputPath && existsSync(this.opts.inputPath)) {
      const readResult = await safeReadInputFile(this.opts.inputPath);
      if (readResult.isOk()) {
        const { content, isFile } = readResult.value;
        this.nodeOutputs.set("__initial__", { inputPath: this.opts.inputPath, content });
        if (isFile) {
          await trace(jobId, `Read input file: ${this.opts.inputPath} (${content.length} chars)`);
        }
      }
    }

    for (const [levelIndex, level] of levels.entries()) {
      await trace(
        jobId,
        `── Level ${levelIndex} (${level.length} node${level.length > 1 ? "s" : ""}) ──`,
      );

      const results = await Promise.all(level.map((node) => this.processNodeWithPause(node)));

      for (const result of results) {
        if (!result.ok) {
          await trace(jobId, `Pipeline failed at level ${levelIndex}`);
          const remainingLevels = levels.slice(levelIndex + 1).flat();
          await Promise.all(remainingLevels.map((node) => this.emitNodeStatus(node.id, "skipped")));
          await this.cleanupTempDirs();

          return { ok: false, error: result.error };
        }
      }
    }

    const outputPaths = rootNodes.flatMap((n) => {
      if (n.data.nodeType !== BUILTIN_NODE_TYPE_ENUM.OUTPUT_LOCAL_PATH) return [];
      const configuredPath = n.data.localPath ?? "";
      const path = configuredPath || this.opts.defaultOutputPath || "";

      return path ? [path] : [];
    });

    const summary =
      outputPaths.length > 0
        ? `Output written to: ${outputPaths.join(", ")}`
        : "Completed (no output-local-path node configured)";

    await trace(jobId, `Pipeline complete. ${summary}`);
    await this.cleanupTempDirs();

    return { ok: true, summary };
  }

  private async resolveNodeInput(nodeId: string): Promise<NodeCtx> {
    const edges = this.opts.pipeline.edges;
    const incomingEdges = edges.filter((edge) => edge.target === nodeId);
    if (incomingEdges.length === 0) {
      return this.nodeOutputs.get("__initial__") ?? { inputPath: "", content: "" };
    }
    const activeEdges = [];
    for (const edge of incomingEdges) {
      if (await this.isEdgeActive(edge)) {
        activeEdges.push(edge);
      }
    }

    if (activeEdges.length === 0) {
      return { inputPath: "", content: "" };
    }

    if (activeEdges.length === 1) {
      const edge = activeEdges[0]!;
      const parentCtx = this.nodeOutputs.get(edge.source) ?? { inputPath: "", content: "" };

      return this.applyEdgeTransform(edge, parentCtx);
    }

    const parentCtxs = activeEdges
      .map((edge) => {
        const parentCtx = this.nodeOutputs.get(edge.source);

        return parentCtx ? this.applyEdgeTransform(edge, parentCtx) : undefined;
      })
      .filter((c): c is NodeCtx => c !== undefined);
    const inputPath = parentCtxs.find((p) => p.inputPath)?.inputPath ?? "";
    const content = parentCtxs
      .map((p) => p.content)
      .filter(Boolean)
      .join("\n\n---\n\n");

    return { inputPath, content };
  }

  private async processNodeWithPause(
    node: PipelineNode,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    if (await this.shouldSkipNodeForInactiveEdges(node)) {
      await trace(this.opts.jobId, encodeNodeSkipped(node.id, "incoming edge condition"));
      await this.emitNodeStatus(node.id, "skipped");

      return { ok: true };
    }

    const event = { jobId: this.opts.jobId, nodeId: node.id, reason: "pause" as const };
    const shouldPause = await this.opts.runControl?.shouldPauseBeforeNode?.(event);

    if (shouldPause) {
      await trace(this.opts.jobId, encodeRunPause(node.id));
      await this.emitNodeStatus(node.id, "waitingForUser");
      await this.opts.runControl?.waitForResume?.(event);
      await trace(this.opts.jobId, encodeRunResume(node.id));
    }

    const firstResult = await this.processNode(node);
    if (firstResult.ok || !this.canSelfHeal(node)) {
      return firstResult;
    }

    const selfHealRetries = this.opts.selfHealRetries ?? DEFAULT_SELF_HEAL_RETRIES;
    for (const attempt of Array.from({ length: selfHealRetries }, (_, i) => i + 1)) {
      await trace(
        this.opts.jobId,
        encodeSelfHeal(node.id, attempt, `Retrying after failure: ${firstResult.error.message}`),
      );
      await this.emitNodeStatus(node.id, "retrying");
      const retryResult = await this.processNode(node);
      if (retryResult.ok) {
        await trace(this.opts.jobId, encodeSelfHealDone(node.id, attempt));

        return retryResult;
      }
    }

    return firstResult;
  }

  private canSelfHeal(node: PipelineNode): boolean {
    return node.data.nodeType === BUILTIN_NODE_TYPE_ENUM.OPERATION;
  }

  private async shouldSkipNodeForInactiveEdges(node: PipelineNode): Promise<boolean> {
    const incomingEdges = this.opts.pipeline.edges.filter((edge) => edge.target === node.id);
    if (incomingEdges.length === 0) return false;

    for (const edge of incomingEdges) {
      if (await this.isEdgeActive(edge)) {
        return false;
      }
    }

    return true;
  }

  private async isEdgeActive(edge: PipelineEdge): Promise<boolean> {
    const cached = this.edgeActiveCache.get(edge.id);
    if (cached !== undefined) return cached;

    const sourceOutput = this.nodeOutputs.get(edge.source);
    if (!sourceOutput) {
      this.edgeActiveCache.set(edge.id, false);

      return false;
    }

    const data = edge.data;
    const conditionPassed = data?.condition
      ? evaluateConditionExpression(data.condition.expression, sourceOutput.content)
      : true;
    const qualityPassed = passesQualityGate(data?.qualityGate, sourceOutput.content);
    const active = conditionPassed && qualityPassed;

    if (!conditionPassed) {
      await trace(
        this.opts.jobId,
        encodeEdgeConditionSkip(edge.id, data?.condition?.expression ?? ""),
      );
    }
    if (!qualityPassed) {
      await trace(
        this.opts.jobId,
        encodeEdgeQualitySkip(edge.id, data?.qualityGate?.criteria ?? ""),
      );
    }

    this.edgeActiveCache.set(edge.id, active);

    return active;
  }

  private applyEdgeTransform(edge: PipelineEdge, input: NodeCtx): NodeCtx {
    const transform = edge.data?.transform;
    if (!transform || transform.steps.length === 0) return input;

    const content = transform.steps.reduce(
      (current, step) => applyTransformStep(current, step),
      input.content,
    );

    return { ...input, content };
  }

  private async processNode(
    node: PipelineNode,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    const { deps, jobId } = this.opts;
    const data = node.data;
    const input = await this.resolveNodeInput(node.id);

    await trace(jobId, `Processing node [${node.type}] ${data.label ?? node.id}`);
    await trace(jobId, encodeNodeStart(node.id));
    await this.emitNodeStatus(node.id, "running");
    if (data.nodeType === BUILTIN_NODE_TYPE_ENUM.OPERATION && data.checkpoint) {
      await this.emitNodeStatus(node.id, "waitingForUser");
      await trace(jobId, encodeCheckpointWait(node.id));
      await this.opts.runControl?.waitForResume?.({
        jobId,
        nodeId: node.id,
        reason: "checkpoint",
      });
      await trace(jobId, encodeCheckpointResume(node.id));
      await this.emitNodeStatus(node.id, "running");
    }

    const baseCtx = {
      node,
      input,
      deps,
      nodeOutputs: this.nodeOutputs,
      tempDirs: this.tempDirs,
      jobId,
      defaultOutputPath: this.opts.defaultOutputPath,
    };

    const metaType = resolveMetaType(node.type);

    // ── object metaType ──────────────────────────────────────────────────
    if (metaType === "object") {
      return this.finalizeNodeStatus(
        node.id,
        await this.processObjectNode(node, baseCtx, data, input),
      );
    }

    // ── operation metaType ───────────────────────────────────────────────
    if (metaType === "operation") {
      if (node.type === BUILTIN_NODE_TYPE_ENUM.OPERATION) {
        const opCtx: OperationNodeContext = {
          ...baseCtx,
          operations: this.opts.operations,
          lookupAgent: this.opts.lookupAgent,
          lookupSkill: this.opts.lookupSkill,
          githubToken: this.opts.githubToken,
          outputDir: this.resolveOutputDirForNode(node.id),
        };

        return this.finalizeNodeStatus(
          node.id,
          await this.wrapNodeResult(node.id, processOperationNode(node, input, opCtx)),
        );
      }

      // compound — passthrough for now
      await trace(jobId, `Skipped ${node.type} node (metaType: operation)`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, encodeNodeDone(node.id));

      return this.finalizeNodeStatus(node.id, { ok: true });
    }

    // ── output metaType ──────────────────────────────────────────────────
    if (metaType === "output") {
      if (node.type === BUILTIN_NODE_TYPE_ENUM.OUTPUT_LOCAL_PATH) {
        return this.finalizeNodeStatus(
          node.id,
          await this.wrapNodeResult(node.id, processOutputLocalPathNode(baseCtx)),
        );
      }

      if (node.data.nodeType === BUILTIN_NODE_TYPE_ENUM.OUTPUT_PROJECT_PATH) {
        const projPath = node.data.path ?? input.inputPath;
        await trace(jobId, `Output-to-project: changes written directly to ${projPath}`);
        this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
        await trace(jobId, encodeNodeDone(node.id));

        return this.finalizeNodeStatus(node.id, { ok: true });
      }

      await trace(jobId, `Skipped output node type: ${node.type}`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, encodeNodeDone(node.id));

      return this.finalizeNodeStatus(node.id, { ok: true });
    }

    // ── decision metaType ────────────────────────────────────────────────
    if (metaType === "decision") {
      return this.finalizeNodeStatus(
        node.id,
        await this.wrapNodeResult(
          node.id,
          processDecisionNode({
            node,
            jobId,
            edges: this.opts.pipeline.edges,
            nodeOutputs: this.nodeOutputs,
            isEdgeActive: (edge) => this.isEdgeActive(edge),
            applyEdgeTransform: (edge, ctx) => this.applyEdgeTransform(edge, ctx),
            nodeLabel: (id) => this.opts.pipeline.nodes.find((n) => n.id === id)?.data.label,
            selectMode: data.nodeType === "decision" ? data.selectMode : "single",
            waitForDecision: this.opts.runControl?.waitForDecision,
            emitStatus: (status) => this.emitNodeStatus(node.id, status),
          }),
        ),
      );
    }

    // fallback — skip
    await trace(jobId, `Skipped node type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, encodeNodeDone(node.id));

    return this.finalizeNodeStatus(node.id, { ok: true });
  }

  private resolveOutputDirForNode(nodeId: string): string | undefined {
    const { edges, nodes } = this.opts.pipeline;
    const childIds = new Set(edges.filter((e) => e.source === nodeId).map((e) => e.target));
    const outputNode = nodes.find(
      (n) => childIds.has(n.id) && n.data.nodeType === BUILTIN_NODE_TYPE_ENUM.OUTPUT_LOCAL_PATH,
    );
    const configuredPath =
      outputNode?.data.nodeType === BUILTIN_NODE_TYPE_ENUM.OUTPUT_LOCAL_PATH
        ? (outputNode.data.localPath ?? "")
        : "";
    const resolved = configuredPath || this.opts.defaultOutputPath || "";

    return resolved || undefined;
  }

  /**
   * Process an object-metaType node.
   * Checks plugin registry first (allows overriding built-in types),
   * then falls back to built-in handlers.
   */
  private async processObjectNode(
    node: PipelineNode,
    baseCtx: {
      node: PipelineNode;
      input: NodeCtx;
      deps: PipelineEngineDeps;
      nodeOutputs: Map<string, NodeCtx>;
      tempDirs: string[];
      jobId: string;
    },
    data: PipelineNodeData,
    input: NodeCtx,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    const { jobId } = this.opts;

    // Plugin handlers take priority — allows overriding built-in object types
    const pluginHandler = pluginRegistry.getNodeHandler(node.type);
    if (pluginHandler) {
      await trace(jobId, `Executing plugin handler for object type: ${node.type}`);
      const result = await pluginHandler({
        nodeId: node.id,
        jobId,
        data: data as Record<string, unknown>,
        input: { inputPath: input.inputPath, content: input.content },
        setOutput: (output) => this.nodeOutputs.set(node.id, output),
        trace: (message) => trace(jobId, message),
      });
      if (!result.ok) {
        return { ok: false, error: new ScriptExecutionError(`Plugin node ${node.id} failed`) };
      }
      await trace(jobId, encodeNodeDone(node.id));

      return { ok: true };
    }

    // Built-in object handlers
    if (node.type === BUILTIN_NODE_TYPE_ENUM.FOLDER) {
      return this.wrapNodeResult(node.id, processFolderNode(baseCtx));
    }

    if (node.type === BUILTIN_NODE_TYPE_ENUM.FILE) {
      return this.wrapNodeResult(node.id, processFileNode(baseCtx));
    }

    if (node.type === BUILTIN_NODE_TYPE_ENUM.PROMPT) {
      return this.wrapNodeResult(node.id, processPromptNode(baseCtx));
    }

    if (node.type === BUILTIN_NODE_TYPE_ENUM.GITHUB_PROJECT) {
      return this.wrapNodeResult(
        node.id,
        processGitHubProjectNode({ ...baseCtx, githubToken: this.opts.githubToken }),
      );
    }

    // Unknown object type — passthrough
    await trace(jobId, `Skipped unknown object type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, encodeNodeDone(node.id));

    return { ok: true };
  }

  /** Unwrap a node handler result, mapping failures to PipelineRunError */
  private async wrapNodeResult(
    nodeId: string,
    promise: Promise<{ ok: true } | { ok: false; error: PipelineRunError | null }>,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    const result = await promise;
    if (!result.ok && result.error) return { ok: false, error: result.error };
    if (!result.ok) return { ok: false, error: new ScriptExecutionError(`Node ${nodeId} failed`) };

    return { ok: true };
  }

  private async finalizeNodeStatus(
    nodeId: string,
    result: { ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError },
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    await this.emitNodeStatus(nodeId, result.ok ? "done" : "failed");

    return result;
  }

  private async emitNodeStatus(nodeId: string, status: NodeRunStatus): Promise<void> {
    await this.opts.onNodeStatusChange?.({ jobId: this.opts.jobId, nodeId, status });
  }

  private async cleanupTempDirs(): Promise<void> {
    for (const dir of this.tempDirs) {
      await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
    }
  }
}
