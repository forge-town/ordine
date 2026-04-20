import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { pluginRegistry } from "@repo/plugin";
import {
  resolveMetaType,
  type PipelineEdge,
  type PipelineNode,
  type NodeData,
  type NodeCtx,
} from "../schemas";
import type { PipelineEngineDeps } from "../deps";
import { ScriptExecutionError, type PipelineRunError } from "../errors";
import { buildExecutionLevels, getParentIds, type CycleDetectedError } from "../dagScheduler";
import { safeReadInputFile } from "../infrastructure";
import type { OperationInfo, SkillInfo, OperationNodeContext } from "../nodes/types";
import { processCodeFileNode } from "../nodes/CodeFileNode";
import { processFolderNode } from "../nodes/FolderNode";
import { processGitHubProjectNode } from "../nodes/GitHubProjectNode";
import { processOutputLocalPathNode } from "../nodes/OutputLocalPathNode";
import { processOperationNode } from "../nodes/OperationNode";

export type PipelineRunResult =
  | { ok: true; summary: string }
  | { ok: false; error: PipelineRunError | CycleDetectedError };

export interface PipelineDefinition {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

export interface PipelineOptions {
  pipeline: PipelineDefinition;
  jobId: string;
  inputPath?: string;
  githubToken?: string;
  operations: Map<string, OperationInfo>;
  deps: PipelineEngineDeps;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  lookupBestPractice: (id: string) => Promise<{ title: string; content: string } | null>;
  onTmuxSession?: (sessionName: string) => Promise<void>;
}

export class Pipeline {
  private opts: PipelineOptions;
  private tempDirs: string[] = [];
  private nodeOutputs = new Map<string, NodeCtx>();

  constructor(opts: PipelineOptions) {
    this.opts = opts;
  }

  async run(): Promise<PipelineRunResult> {
    this.tempDirs = [];
    this.nodeOutputs = new Map();

    const { pipeline, jobId } = this.opts;
    const { nodes, edges } = pipeline;

    const levelsResult = buildExecutionLevels(nodes, edges);
    if (levelsResult.isErr()) {
      return { ok: false, error: levelsResult.error };
    }
    const levels = levelsResult.value;

    await trace(
      jobId,
      `Pipeline "${pipeline.name}" loaded. ${nodes.length} nodes in ${levels.length} levels.`,
    );

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

      const results = await Promise.all(level.map((node) => this.processNode(node)));

      for (const result of results) {
        if (!result.ok) {
          await trace(jobId, `Pipeline failed at level ${levelIndex}`);
          await this.cleanupTempDirs();

          return { ok: false, error: result.error };
        }
      }
    }

    const outputPaths = nodes
      .filter((n) => n.type === "output-local-path")
      .map((n) => {
        const d = n.data as NodeData;

        return d.localPath ?? String((d as Record<string, unknown>).path ?? "");
      })
      .filter(Boolean);

    const summary =
      outputPaths.length > 0
        ? `Output written to: ${outputPaths.join(", ")}`
        : "Completed (no output-local-path node configured)";

    await trace(jobId, `Pipeline complete. ${summary}`);
    await this.cleanupTempDirs();

    return { ok: true, summary };
  }

  private resolveNodeInput(nodeId: string): NodeCtx {
    const edges = this.opts.pipeline.edges;
    const parentIds = getParentIds(nodeId, edges);
    if (parentIds.length === 0) {
      return this.nodeOutputs.get("__initial__") ?? { inputPath: "", content: "" };
    }
    if (parentIds.length === 1) {
      return this.nodeOutputs.get(parentIds[0]!) ?? { inputPath: "", content: "" };
    }
    const parentCtxs = parentIds
      .map((id) => this.nodeOutputs.get(id))
      .filter((c): c is NodeCtx => c !== undefined);
    const inputPath = parentCtxs.find((p) => p.inputPath)?.inputPath ?? "";
    const content = parentCtxs
      .map((p) => p.content)
      .filter(Boolean)
      .join("\n\n---\n\n");

    return { inputPath, content };
  }

  private async processNode(
    node: PipelineNode,
  ): Promise<{ ok: true } | { ok: false; error: PipelineRunError | CycleDetectedError }> {
    const { deps, jobId } = this.opts;
    const data = node.data as unknown as NodeData;
    const input = this.resolveNodeInput(node.id);

    await trace(
      jobId,
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`,
    );
    await trace(jobId, `@@NODE_START::${node.id}`);

    const baseCtx = {
      node,
      input,
      deps,
      nodeOutputs: this.nodeOutputs,
      tempDirs: this.tempDirs,
      jobId,
      onTmuxSession: this.opts.onTmuxSession,
    };

    const metaType = resolveMetaType(node.type, node.metaType);

    // ── object metaType ──────────────────────────────────────────────────
    if (metaType === "object") {
      return this.processObjectNode(node, baseCtx, data, input);
    }

    // ── operation metaType ───────────────────────────────────────────────
    if (metaType === "operation") {
      if (node.type === "operation") {
        const opCtx: OperationNodeContext = {
          ...baseCtx,
          operations: this.opts.operations,
          lookupSkill: this.opts.lookupSkill,
          lookupBestPractice: this.opts.lookupBestPractice,
          githubToken: this.opts.githubToken,
        };

        return this.wrapNodeResult(node.id, processOperationNode(node, input, opCtx));
      }

      // compound / condition — passthrough for now
      await trace(jobId, `Skipped ${node.type} node (metaType: operation)`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, `@@NODE_DONE::${node.id}`);

      return { ok: true };
    }

    // ── output metaType ──────────────────────────────────────────────────
    if (metaType === "output") {
      if (node.type === "output-local-path") {
        return this.wrapNodeResult(node.id, processOutputLocalPathNode(baseCtx));
      }

      if (node.type === "output-project-path") {
        const projPath = (data as Record<string, unknown>).path ?? input.inputPath;
        await trace(jobId, `Output-to-project: changes written directly to ${projPath}`);
        this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
        await trace(jobId, `@@NODE_DONE::${node.id}`);

        return { ok: true };
      }

      await trace(jobId, `Skipped output node type: ${node.type}`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, `@@NODE_DONE::${node.id}`);

      return { ok: true };
    }

    // fallback — skip
    await trace(jobId, `Skipped node type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, `@@NODE_DONE::${node.id}`);

    return { ok: true };
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
    data: NodeData,
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
      await trace(jobId, `@@NODE_DONE::${node.id}`);

      return { ok: true };
    }

    // Built-in object handlers
    if (node.type === "folder") {
      return this.wrapNodeResult(node.id, processFolderNode(baseCtx));
    }

    if (node.type === "code-file") {
      return this.wrapNodeResult(node.id, processCodeFileNode(baseCtx));
    }

    if (node.type === "github-project") {
      return this.wrapNodeResult(
        node.id,
        processGitHubProjectNode({ ...baseCtx, githubToken: this.opts.githubToken }),
      );
    }

    // Unknown object type — passthrough
    await trace(jobId, `Skipped unknown object type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, `@@NODE_DONE::${node.id}`);

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

  private async cleanupTempDirs(): Promise<void> {
    for (const dir of this.tempDirs) {
      await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
    }
  }
}
