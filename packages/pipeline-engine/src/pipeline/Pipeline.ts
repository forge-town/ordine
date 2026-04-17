import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { ResultAsync } from "neverthrow";
import { trace } from "@repo/obs";
import { pluginRegistry } from "@repo/plugin";
import type { PipelineNode, NodeData, NodeCtx } from "../schemas";
import type { PipelineEngineDeps } from "../deps";
import type { PipelineRunError } from "../errors";
import { ScriptExecutionError } from "../errors";
import { buildExecutionLevels, getParentIds, CycleDetectedError } from "../dagScheduler";
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
        const d = n.data as unknown as NodeData;
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
      const result = await processOutputLocalPathNode(baseCtx);
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
      await trace(jobId, `Output-to-project: changes written directly to ${projPath}`);
      this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
      await trace(jobId, `@@NODE_DONE::${node.id}`);
      return { ok: true };
    }

    // Check plugin registry for custom object types
    const pluginHandler = pluginRegistry.getNodeHandler(node.type);
    if (pluginHandler) {
      await trace(jobId, `Executing plugin handler for node type: ${node.type}`);
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

    await trace(jobId, `Skipped node type: ${node.type}`);
    this.nodeOutputs.set(node.id, { inputPath: input.inputPath, content: input.content });
    await trace(jobId, `@@NODE_DONE::${node.id}`);
    return { ok: true };
  }

  private async cleanupTempDirs(): Promise<void> {
    for (const dir of this.tempDirs) {
      await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
    }
  }
}
