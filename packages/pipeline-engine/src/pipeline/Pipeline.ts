import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { pluginRegistry } from "@repo/plugin";
import type { NodeCtx, PipelineGlobalContext } from "../schemas";
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
import { PipelineCancelledError, ScriptExecutionError, type PipelineRunError } from "../errors";
import { buildExecutionLevels, type CycleDetectedError } from "../dagScheduler";
import { expandTilde, safeReadInputFile } from "../infrastructure";
import type {
  AgentInfo,
  NodeResult,
  OperationInfo,
  OperationNodeContext,
  SkillInfo,
} from "../nodes/types";
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

/**
 * Matches an edge condition against the source node's output. Not a general expression
 * evaluator: it recognizes exactly the literals `true`/`false` and the forms
 * `content.includes("...")` / `!content.includes("...")` (`output.` works too);
 * any other expression falls back to a substring match on the content.
 */
const matchEdgeCondition = (expression: string, content: string): boolean => {
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
  description?: string;
  sharedContext?: string;
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
  /** Cancellation checkpoint: checked at every node boundary (and again after a resume wake-up). When it returns true the run stops scheduling further nodes and settles as cancelled. */
  shouldCancelBeforeNode?: (event: PipelineRunControlEvent) => boolean | Promise<boolean>;
  waitForResume?: (event: PipelineRunControlEvent) => Promise<void>;
  /** Decision-node suspension: resolves with the candidate source-node id the user picked. When absent, decision nodes fail — choices are never fabricated. */
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
  /** Number of self-heal retries (0 = stop on failure, no automatic retry). */
  selfHealRetries?: number;
}

export class Pipeline {
  private opts: PipelineOptions;
  private tempDirs: string[] = [];
  private nodeOutputs = new Map<string, NodeCtx>();
  private edgeEvaluationCache = new Map<
    string,
    { active: boolean; gateFailure?: ScriptExecutionError }
  >();

  constructor(opts: PipelineOptions) {
    this.opts = opts;
  }

  async run(): Promise<PipelineRunResult> {
    this.tempDirs = [];
    this.nodeOutputs = new Map();
    this.edgeEvaluationCache = new Map();

    const { pipeline, jobId } = this.opts;
    const { nodes, edges } = pipeline;
    const rootNodeIds = new Set(nodes.filter(isRootNode).map((node) => node.id));
    const rootNodes = nodes.filter((node) => rootNodeIds.has(node.id));
    const rootEdges = edges.filter(
      (edge) => rootNodeIds.has(edge.source) && rootNodeIds.has(edge.target),
    );

    // Quality gates only implement "skip" and "fail" so far; reject "retry" up front
    // instead of silently running it with the wrong semantics.
    const retryGateEdge = edges.find((edge) => edge.data?.qualityGate?.onFail === "retry");
    if (retryGateEdge) {
      return {
        ok: false,
        error: new ScriptExecutionError(
          `Quality gate onFail "retry" is not supported yet (edge ${retryGateEdge.id}); use "skip" or "fail"`,
        ),
      };
    }

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
          const cancelled = result.error instanceof PipelineCancelledError;
          await trace(
            jobId,
            cancelled
              ? `Pipeline cancelled at level ${levelIndex}`
              : `Pipeline failed at level ${levelIndex}`,
          );
          const remainingLevels = levels.slice(levelIndex + 1).flat();
          await Promise.all(remainingLevels.map((node) => this.emitNodeStatus(node.id, "skipped")));
          await this.cleanupTempDirs();

          return { ok: false, error: result.error };
        }
      }
    }

    const outputPaths = rootNodes.flatMap((n) => {
      if (n.data.nodeType !== BUILTIN_NODE_TYPE_ENUM.OUTPUT_LOCAL_PATH) return [];
      // Only report outputs that actually completed — skipped/failed output nodes
      // record no output and must not show up in the success summary.
      if (!this.nodeOutputs.has(n.id)) return [];
      const configuredPath = n.data.localPath ?? "";
      const path = expandTilde(configuredPath || this.opts.defaultOutputPath || "");

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

  /**
   * Settle a node that was reached after cancellation was requested: it never
   * ran, so it is marked skipped, and the run stops with PipelineCancelledError.
   */
  private async stopForCancellation(
    nodeId: string,
  ): Promise<{ ok: false; error: PipelineRunError }> {
    await trace(this.opts.jobId, `Run cancelled — stopping before node ${nodeId}`);
    await this.emitNodeStatus(nodeId, "skipped");

    return { ok: false, error: new PipelineCancelledError(nodeId) };
  }

  private async processNodeWithPause(
    node: PipelineNode,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    const edgeCheck = await this.evaluateIncomingEdges(node);
    if (edgeCheck.outcome === "abort") {
      await this.emitNodeStatus(node.id, "failed");

      return { ok: false, error: edgeCheck.error };
    }
    if (edgeCheck.outcome === "skip") {
      await trace(this.opts.jobId, encodeNodeSkipped(node.id, "incoming edge condition"));
      await this.emitNodeStatus(node.id, "skipped");

      return { ok: true };
    }

    const event = { jobId: this.opts.jobId, nodeId: node.id, reason: "pause" as const };

    // Cancellation checkpoint at the node boundary: never start another node
    // once cancellation has been requested.
    if (await this.opts.runControl?.shouldCancelBeforeNode?.(event)) {
      return this.stopForCancellation(node.id);
    }

    const shouldPause = await this.opts.runControl?.shouldPauseBeforeNode?.(event);

    if (shouldPause) {
      // Fail closed: a requested pause without a resume handler must never fall through,
      // or the human approval it represents would be silently bypassed.
      const waitForResume = this.opts.runControl?.waitForResume;
      if (!waitForResume) {
        await this.emitNodeStatus(node.id, "failed");

        return {
          ok: false,
          error: new ScriptExecutionError(
            `Node ${node.id} requested a pause but no resume handler is wired — refusing to continue without approval`,
          ),
        };
      }
      await trace(this.opts.jobId, encodeRunPause(node.id));
      await this.emitNodeStatus(node.id, "waitingForUser");
      await waitForResume(event);
      await trace(this.opts.jobId, encodeRunResume(node.id));

      // Re-check after the wake-up: a paused run released by a cancellation
      // request must stop here instead of running the next node.
      if (await this.opts.runControl?.shouldCancelBeforeNode?.(event)) {
        return this.stopForCancellation(node.id);
      }
    }

    const firstResult = await this.processNode(node);
    if (firstResult.ok || !this.canSelfHeal(node)) {
      return firstResult;
    }

    const retryState = { lastFailure: firstResult };
    const selfHealRetries = this.opts.selfHealRetries ?? DEFAULT_SELF_HEAL_RETRIES;
    for (const attempt of Array.from({ length: selfHealRetries }, (_, i) => i + 1)) {
      await trace(
        this.opts.jobId,
        encodeSelfHeal(
          node.id,
          attempt,
          `Retrying after failure: ${retryState.lastFailure.error.message}`,
        ),
      );
      await this.emitNodeStatus(node.id, "retrying");
      const retryResult = await this.processNode(node);
      if (retryResult.ok) {
        await trace(this.opts.jobId, encodeSelfHealDone(node.id, attempt));

        return retryResult;
      }
      retryState.lastFailure = retryResult;
    }

    return retryState.lastFailure;
  }

  private canSelfHeal(node: PipelineNode): boolean {
    return node.data.nodeType === BUILTIN_NODE_TYPE_ENUM.OPERATION;
  }

  /**
   * Evaluate all incoming edges of a node: "proceed" if at least one edge is active
   * (or the node has no incoming edges), "skip" if every edge is inactive, and
   * "abort" as soon as any failed quality gate is configured with onFail "fail".
   */
  private async evaluateIncomingEdges(
    node: PipelineNode,
  ): Promise<{ outcome: "proceed" | "skip" } | { outcome: "abort"; error: PipelineRunError }> {
    const incomingEdges = this.opts.pipeline.edges.filter((edge) => edge.target === node.id);
    if (incomingEdges.length === 0) return { outcome: "proceed" };

    const evaluations = [];
    for (const edge of incomingEdges) {
      const evaluation = await this.evaluateEdge(edge);
      if (evaluation.gateFailure) return { outcome: "abort", error: evaluation.gateFailure };
      evaluations.push(evaluation);
    }

    return evaluations.some((evaluation) => evaluation.active)
      ? { outcome: "proceed" }
      : { outcome: "skip" };
  }

  private async isEdgeActive(edge: PipelineEdge): Promise<boolean> {
    const evaluation = await this.evaluateEdge(edge);

    return evaluation.active;
  }

  private async evaluateEdge(
    edge: PipelineEdge,
  ): Promise<{ active: boolean; gateFailure?: ScriptExecutionError }> {
    const cached = this.edgeEvaluationCache.get(edge.id);
    if (cached !== undefined) return cached;

    const sourceOutput = this.nodeOutputs.get(edge.source);
    if (!sourceOutput) {
      const result = { active: false };
      this.edgeEvaluationCache.set(edge.id, result);

      return result;
    }

    const data = edge.data;
    const conditionPassed = data?.condition
      ? matchEdgeCondition(data.condition.expression, sourceOutput.content)
      : true;
    const qualityPassed = passesQualityGate(data?.qualityGate, sourceOutput.content);

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

    const result =
      !qualityPassed && data?.qualityGate?.onFail === "fail"
        ? {
            active: false,
            gateFailure: new ScriptExecutionError(
              `Quality gate failed on edge ${edge.id} (criteria: "${data.qualityGate.criteria}") — onFail is "fail", aborting the run`,
            ),
          }
        : { active: conditionPassed && qualityPassed };

    this.edgeEvaluationCache.set(edge.id, result);

    return result;
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
      // Fail closed: a checkpoint without a resume handler must never fall through,
      // or the human approval it represents would be silently bypassed.
      const waitForResume = this.opts.runControl?.waitForResume;
      if (!waitForResume) {
        return this.finalizeNodeStatus(node.id, {
          outcome: "failed",
          error: new ScriptExecutionError(
            `Node ${node.id} is a checkpoint but no resume handler is wired — refusing to proceed without approval`,
          ),
        });
      }
      await this.emitNodeStatus(node.id, "waitingForUser");
      await trace(jobId, encodeCheckpointWait(node.id));
      const checkpointEvent = { jobId, nodeId: node.id, reason: "checkpoint" as const };
      await waitForResume(checkpointEvent);
      await trace(jobId, encodeCheckpointResume(node.id));

      // Re-check after the wake-up: a checkpoint released by a cancellation
      // request must stop here instead of executing the node.
      if (await this.opts.runControl?.shouldCancelBeforeNode?.(checkpointEvent)) {
        return this.stopForCancellation(node.id);
      }
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
          pipelineContext: this.buildPipelineContext(),
          githubToken: this.opts.githubToken,
          outputDir: this.resolveOutputDirForNode(node.id),
        };

        return this.finalizeNodeStatus(node.id, await processOperationNode(node, input, opCtx));
      }

      // compound — passthrough for now
      await trace(jobId, `Skipped ${node.type} node (metaType: operation)`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, encodeNodeDone(node.id));

      return this.finalizeNodeStatus(node.id, { outcome: "completed" });
    }

    // ── output metaType ──────────────────────────────────────────────────
    if (metaType === "output") {
      if (node.type === BUILTIN_NODE_TYPE_ENUM.OUTPUT_LOCAL_PATH) {
        return this.finalizeNodeStatus(node.id, await processOutputLocalPathNode(baseCtx));
      }

      if (node.data.nodeType === BUILTIN_NODE_TYPE_ENUM.OUTPUT_PROJECT_PATH) {
        const projPath = node.data.path ?? input.inputPath;
        await trace(jobId, `Output-to-project: changes written directly to ${projPath}`);
        this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
        await trace(jobId, encodeNodeDone(node.id));

        return this.finalizeNodeStatus(node.id, { outcome: "completed" });
      }

      await trace(jobId, `Skipped output node type: ${node.type}`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, encodeNodeDone(node.id));

      return this.finalizeNodeStatus(node.id, { outcome: "completed" });
    }

    // ── decision metaType ────────────────────────────────────────────────
    if (metaType === "decision") {
      return this.finalizeNodeStatus(
        node.id,
        await processDecisionNode({
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
      );
    }

    // fallback — skip
    await trace(jobId, `Skipped node type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, encodeNodeDone(node.id));

    return this.finalizeNodeStatus(node.id, { outcome: "completed" });
  }

  // Bundles the parent pipeline's global context (name/description/sharedContext) so
  // operations can inject it into the agent prompt alongside — but distinct from —
  // each operation's local duties.
  private buildPipelineContext(): PipelineGlobalContext {
    const { pipeline } = this.opts;

    return {
      name: pipeline.name,
      description: pipeline.description ?? "",
      sharedContext: pipeline.sharedContext ?? "",
    };
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
    const resolved = expandTilde(configuredPath || this.opts.defaultOutputPath || "");

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
  ): Promise<NodeResult> {
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
        return {
          outcome: "failed",
          error: new ScriptExecutionError(`Plugin node ${node.id} failed`),
        };
      }
      await trace(jobId, encodeNodeDone(node.id));

      return { outcome: "completed" };
    }

    // Built-in object handlers
    if (node.type === BUILTIN_NODE_TYPE_ENUM.FOLDER) {
      return processFolderNode(baseCtx);
    }

    if (node.type === BUILTIN_NODE_TYPE_ENUM.FILE) {
      return processFileNode(baseCtx);
    }

    if (node.type === BUILTIN_NODE_TYPE_ENUM.PROMPT) {
      return processPromptNode(baseCtx);
    }

    if (node.type === BUILTIN_NODE_TYPE_ENUM.GITHUB_PROJECT) {
      return processGitHubProjectNode({ ...baseCtx, githubToken: this.opts.githubToken });
    }

    // Unknown object type — passthrough
    await trace(jobId, `Skipped unknown object type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, encodeNodeDone(node.id));

    return { outcome: "completed" };
  }

  /**
   * Emit the node's final status and translate its outcome into the run-level result:
   * a soft failure marks the node failed but lets the run continue, while a hard
   * failure aborts the run with its error.
   */
  private async finalizeNodeStatus(
    nodeId: string,
    result: NodeResult,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    if (result.outcome === "failed") {
      await this.emitNodeStatus(nodeId, "failed");

      return { ok: false, error: result.error };
    }
    await this.emitNodeStatus(nodeId, result.outcome === "soft-failed" ? "failed" : "done");

    return { ok: true };
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
