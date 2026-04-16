import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import type { PipelineNode, NodeData, NodeCtx } from "../schemas/index.js";
import type { PipelineEngineDeps } from "../deps.js";
import type { PipelineRunError } from "../errors.js";
import { ScriptExecutionError } from "../errors.js";
import { buildExecutionLevels, getParentIds, CycleDetectedError } from "../dagScheduler.js";
import { safeReadInputFile } from "../infrastructure.js";
import type { OperationInfo, SkillInfo, OperationNodeContext } from "../nodes/types.js";
import { processCodeFileNode } from "../nodes/CodeFileNode.js";
import { processFolderNode } from "../nodes/FolderNode.js";
import { processGitHubProjectNode } from "../nodes/GitHubProjectNode.js";
import { processOutputLocalPathNode } from "../nodes/OutputLocalPathNode.js";
import { processOperationNode } from "../nodes/OperationNode.js";

export type PipelineRunResult =
  | { ok: true; summary: string }
  | { ok: false; error: PipelineRunError | CycleDetectedError };

export interface PipelineDefinition {
  id: string;
  name: string;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

import type { PipelineEdge } from "../schemas/index.js";

export interface PipelineOptions {
  pipeline: PipelineDefinition;
  jobId: string;
  inputPath?: string;
  githubToken?: string;
  operations: Map<string, OperationInfo>;
  deps: PipelineEngineDeps;
  lookupSkill: (id: string) => Promise<SkillInfo | null>;
  lookupBestPractice: (id: string) => Promise<{ title: string; content: string } | null>;
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

    const { pipeline, deps } = this.opts;
    const { log } = deps;
    const { nodes, edges } = pipeline;

    const levelsResult = buildExecutionLevels(nodes, edges);
    if (levelsResult.isErr()) {
      return { ok: false, error: levelsResult.error };
    }
    const levels = levelsResult.value;

    await log(
      `Pipeline "${pipeline.name}" loaded. ${nodes.length} nodes in ${levels.length} levels.`,
    );

    if (this.opts.inputPath && existsSync(this.opts.inputPath)) {
      const readResult = await safeReadInputFile(this.opts.inputPath);
      if (readResult.isOk()) {
        const { content, isFile } = readResult.value;
        this.nodeOutputs.set("__initial__", { inputPath: this.opts.inputPath, content });
        if (isFile) {
          await log(`Read input file: ${this.opts.inputPath} (${content.length} chars)`);
        }
      }
    }

    for (const [levelIndex, level] of levels.entries()) {
      await log(`── Level ${levelIndex} (${level.length} node${level.length > 1 ? "s" : ""}) ──`);

      const results = await Promise.all(level.map((node) => this.processNode(node)));

      for (const result of results) {
        if (!result.ok) {
          await log(`Pipeline failed at level ${levelIndex}`);
          await this.cleanupTempDirs();
          return { ok: false, error: result.error };
        }
      }
    }

    const outputPaths = nodes
      .filter((n) => n.type === "output-local-path")
      .map((n) => {
        const d = n.data as unknown as NodeData;
        return d.localPath ?? String((d as Record<string, unknown>).path ?? "");
      })
      .filter(Boolean);

    const summary =
      outputPaths.length > 0
        ? `Output written to: ${outputPaths.join(", ")}`
        : "Completed (no output-local-path node configured)";

    await log(`Pipeline complete. ${summary}`);
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
    const { deps } = this.opts;
    const { log } = deps;
    const data = node.data as unknown as NodeData;
    const input = this.resolveNodeInput(node.id);

    await log(
      `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`,
    );
    await log(`@@NODE_START::${node.id}`);

    const baseCtx = {
      node,
      input,
      deps,
      nodeOutputs: this.nodeOutputs,
      tempDirs: this.tempDirs,
    };

    if (node.type === "folder") {
      const result = await processFolderNode(baseCtx);
      if (!result.ok && result.error) return { ok: false, error: result.error };
      if (!result.ok)
        return { ok: false, error: new ScriptExecutionError(`Node ${node.id} failed`) };
      return { ok: true };
    }

    if (node.type === "code-file") {
      const result = await processCodeFileNode(baseCtx);
      if (!result.ok && result.error) return { ok: false, error: result.error };
      if (!result.ok)
        return { ok: false, error: new ScriptExecutionError(`Node ${node.id} failed`) };
      return { ok: true };
    }

    if (node.type === "github-project") {
      const result = await processGitHubProjectNode({
        ...baseCtx,
        githubToken: this.opts.githubToken,
      });
      if (!result.ok && result.error) return { ok: false, error: result.error };
      if (!result.ok)
        return { ok: false, error: new ScriptExecutionError(`Node ${node.id} failed`) };
      return { ok: true };
    }

    if (node.type === "output-local-path") {
      const result = await processOutputLocalPathNode({ ...baseCtx, jobId: this.opts.jobId });
      if (!result.ok && result.error) return { ok: false, error: result.error };
      if (!result.ok)
        return { ok: false, error: new ScriptExecutionError(`Node ${node.id} failed`) };
      return { ok: true };
    }

    if (node.type === "operation") {
      const opCtx: OperationNodeContext = {
        ...baseCtx,
        operations: this.opts.operations,
        lookupSkill: this.opts.lookupSkill,
        lookupBestPractice: this.opts.lookupBestPractice,
        jobId: this.opts.jobId,
        githubToken: this.opts.githubToken,
      };
      const result = await processOperationNode(node, input, opCtx);
      if (!result.ok && result.error) return { ok: false, error: result.error };
      if (!result.ok)
        return { ok: false, error: new ScriptExecutionError(`Node ${node.id} failed`) };
      return { ok: true };
    }

    if (node.type === "output-project-path") {
      const projPath = (data as Record<string, unknown>).path ?? input.inputPath;
      await log(`Output-to-project: changes written directly to ${projPath}`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await log(`@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    await log(`Skipped node type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await log(`@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async cleanupTempDirs(): Promise<void> {
    for (const dir of this.tempDirs) {
      await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
    }
  }
}
