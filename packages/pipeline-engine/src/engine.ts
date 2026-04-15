/**
 * Pipeline execution engine — DAG-based concurrent executor.
 *
 * Nodes are partitioned into execution levels via Kahn's algorithm.
 * Nodes within the same level run concurrently via Promise.all.
 * Each node maintains its own output context (NodeCtx), so fan-out
 * branches receive isolated inputs from their parent nodes.
 *
 * Supports four executor types:
 *   - script     → runs a shell/python/js command via child_process
 *   - prompt     → sends input to an AI model via @ai-sdk/openai
 *   - skill      → looks up skill metadata and delegates to an AI model
 *   - rule-check → scans files against enabled rules with regex patterns
 *
 * Progress is tracked through a Job record in the DB.
 */

import { existsSync, statSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { ResultAsync, ok } from "neverthrow";
import type { PipelineNode, PipelineEdge } from "@repo/db-schema";
import {
  operationsDao,
  pipelinesDao,
  jobsDao,
  settingsDao,
  type OperationEntity,
} from "@repo/models";
import { buildExecutionLevels, createLlmService } from "@repo/services";
import {
  PipelineNotFoundError,
  ScriptExecutionError,
  type NodeData,
  type NodeCtx,
  type PipelineRunError,
  type PipelineExecutionCtx,
  type PipelineEngineDeps,
} from "./types";
import { processNode } from "./nodeDispatcher";

const llmService = createLlmService(settingsDao);

const safeReadInputFile = (
  path: string,
): ResultAsync<{ content: string; isFile: boolean }, never> =>
  ResultAsync.fromPromise(
    (async () => {
      const stat = statSync(path);
      if (stat.isFile()) {
        const content = await readFile(path, "utf8");
        return { content, isFile: true };
      }
      return { content: path, isFile: false };
    })(),
    () => ({ content: path, isFile: false }),
  ).orElse((fallback) => ok(fallback));

const executePipeline = async (
  opts: {
    pipelineId: string;
    inputPath?: string;
    jobId: string;
    githubToken?: string;
  },
  deps: PipelineEngineDeps,
): Promise<{ ok: true; summary: string } | { ok: false; error: PipelineRunError }> => {
  const { pipelineId, jobId, githubToken } = opts;

  const ctx: PipelineExecutionCtx = {
    jobId,
    githubToken,
    nodeOutputs: new Map<string, NodeCtx>(),
    tempDirs: [],
    operationsMap: new Map<string, OperationEntity>(),
    edges: [],
    log: async (line: string) => {
      await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ${line}`);
    },
    getSettings: llmService.getSettings,
    getModel: llmService.getModel,
  };

  await jobsDao.updateStatus(jobId, "running", { startedAt: Date.now() });
  await ctx.log(`Starting pipeline ${pipelineId}`);

  const pipeline = await pipelinesDao.findById(pipelineId);
  if (!pipeline) {
    return { ok: false, error: new PipelineNotFoundError(pipelineId) };
  }

  const nodes = pipeline.nodes as PipelineNode[];
  const edges = pipeline.edges as PipelineEdge[];
  ctx.edges = edges;

  const levels = buildExecutionLevels(nodes, edges);

  await ctx.log(
    `Pipeline "${pipeline.name}" loaded. ${nodes.length} nodes in ${levels.length} levels.`,
  );

  const operationIds = nodes
    .filter((n) => n.type === "operation")
    .map((n) => (n.data as unknown as NodeData).operationId)
    .filter((id): id is string => id !== undefined && id !== null && id !== "");

  for (const id of operationIds) {
    const op = await operationsDao.findById(id);
    if (op) ctx.operationsMap.set(id, op);
  }

  // ── Resolve initial input if provided ──────────────────────────────────

  if (opts.inputPath && existsSync(opts.inputPath)) {
    const readResult = await safeReadInputFile(opts.inputPath);
    if (readResult.isOk()) {
      const { content, isFile } = readResult.value;
      ctx.nodeOutputs.set("__initial__", { inputPath: opts.inputPath, content });
      if (isFile) {
        await ctx.log(`Read input file: ${opts.inputPath} (${content.length} chars)`);
      }
    }
  }

  // ── Walk nodes level-by-level (concurrent within each level) ───────────

  for (const [levelIndex, level] of levels.entries()) {
    await ctx.log(`── Level ${levelIndex} (${level.length} node${level.length > 1 ? "s" : ""}) ──`);

    const results = await Promise.all(level.map((node) => processNode(ctx, node, deps)));

    for (const result of results) {
      if (!result.ok) {
        await ctx.log(`Pipeline failed at level ${levelIndex}`);
        for (const dir of ctx.tempDirs) {
          await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
        }
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

  await ctx.log(`Pipeline complete. ${summary}`);

  for (const dir of ctx.tempDirs) {
    await ResultAsync.fromPromise(rm(dir, { recursive: true, force: true }), () => undefined);
  }

  return { ok: true, summary };
};

export const createPipelineRunner = (deps: PipelineEngineDeps) => {
  return async (opts: {
    pipelineId: string;
    inputPath?: string;
    jobId: string;
    githubToken?: string;
  }): Promise<void> => {
    const result = await ResultAsync.fromPromise(
      executePipeline(opts, deps),
      (cause) =>
        new ScriptExecutionError(
          cause instanceof Error ? cause.message : String(cause),
          cause,
        ) as PipelineRunError,
    );

    const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };

    if (outcome.ok) {
      await jobsDao.updateStatus(opts.jobId, "done", {
        finishedAt: Date.now(),
        result: { summary: outcome.summary },
      });
    } else {
      const message = outcome.error.message;
      await jobsDao.appendLog(opts.jobId, `[${new Date().toISOString()}] ERROR: ${message}`);
      await jobsDao.updateStatus(opts.jobId, "failed", {
        finishedAt: Date.now(),
        error: message,
      });
    }
  };
};
