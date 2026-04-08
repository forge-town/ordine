/**
 * Pipeline execution engine.
 *
 * Traverses pipeline nodes in topological order and executes each one,
 * passing results between nodes. Supports three executor types:
 *   - script  → runs a shell/python/js command via child_process
 *   - prompt  → sends input to an AI model via @ai-sdk/openai
 *   - skill   → placeholder (logs a warning)
 *
 * Progress is tracked through a Job record in the DB.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { PipelineNode, PipelineEdge } from "@/models/types/pipelineGraph";
import { type OperationEntity, operationsDao } from "@/models/daos/operationsDao";
import { pipelinesDao } from "@/models/daos/pipelinesDao";
import { jobsDao } from "@/models/daos/jobsDao";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";

const execAsync = promisify(exec);

// ─── types ────────────────────────────────────────────────────────────────────

interface NodeData {
  nodeType?: string;
  folderPath?: string;
  filePath?: string;
  localPath?: string;
  operationId?: string;
}

interface OperationConfig {
  executor?: ExecutorConfig;
}

// ─── topological sort ─────────────────────────────────────────────────────────

const topoSort = (nodes: PipelineNode[], edges: PipelineEdge[]): PipelineNode[] => {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: PipelineNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id);
    if (node) order.push(node);
    for (const neighbour of adjacency.get(id) ?? []) {
      const newDeg = (inDegree.get(neighbour) ?? 1) - 1;
      inDegree.set(neighbour, newDeg);
      if (newDeg === 0) queue.push(neighbour);
    }
  }

  return order;
};

// ─── executor helpers ─────────────────────────────────────────────────────────

const runScript = async (
  executor: ExecutorConfig,
  inputPath: string,
  inputContent: string
): Promise<string> => {
  const lang = executor.language ?? "bash";
  const command = executor.command ?? "";
  if (!command.trim()) throw new Error("Script command is empty");

  const env = {
    ...process.env,
    INPUT_PATH: inputPath,
    INPUT_CONTENT: inputContent,
  };

  if (lang === "bash") {
    const { stdout } = await execAsync(command, { env, timeout: 60_000 });
    return stdout;
  }

  if (lang === "python") {
    const { stdout } = await execAsync(`python3 -c ${JSON.stringify(command)}`, {
      env,
      timeout: 60_000,
    });
    return stdout;
  }

  if (lang === "javascript") {
    const { stdout } = await execAsync(`node -e ${JSON.stringify(command)}`, {
      env,
      timeout: 60_000,
    });
    return stdout;
  }

  throw new Error(`Unknown script language: ${lang}`);
};

const runPrompt = async (executor: ExecutorConfig, inputContent: string): Promise<string> => {
  const prompt = executor.prompt;
  if (!prompt?.trim()) throw new Error("Prompt text is empty");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `${prompt}\n\nInput:\n${inputContent}`,
  });
  return text;
};

// ─── main runner ──────────────────────────────────────────────────────────────

export const runPipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
}): Promise<void> => {
  const { pipelineId, jobId } = opts;
  let inputPath = opts.inputPath ?? "";

  const log = async (line: string) => {
    await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ${line}`);
  };

  try {
    await jobsDao.updateStatus(jobId, "running", { startedAt: Date.now() });
    await log(`Starting pipeline ${pipelineId}`);

    // Load pipeline
    const pipeline = await pipelinesDao.findById(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    const nodes = pipeline.nodes as PipelineNode[];
    const edges = pipeline.edges as PipelineEdge[];
    const ordered = topoSort(nodes, edges);

    await log(`Pipeline "${pipeline.name}" loaded. Processing ${ordered.length} nodes.`);

    // Load all operations referenced in the pipeline
    const operationIds = ordered
      .filter((n) => n.type === "operation")
      .map((n) => (n.data as unknown as NodeData).operationId)
      .filter((id): id is string => id !== undefined && id !== null && id !== "");

    const operationsMap = new Map<string, OperationEntity>();
    for (const id of operationIds) {
      const op = await operationsDao.findById(id);
      if (op) operationsMap.set(id, op);
    }

    // Context accumulates output across nodes
    let currentContent = "";
    let outputLocalPath = "";

    // Resolve initial input if a path was given
    if (inputPath && existsSync(inputPath)) {
      try {
        const { statSync } = await import("node:fs");
        const stat = statSync(inputPath);
        if (stat.isFile()) {
          currentContent = await readFile(inputPath, "utf8");
          await log(`Read input file: ${inputPath} (${currentContent.length} chars)`);
        } else {
          currentContent = inputPath; // for folders, pass the path as content
        }
      } catch {
        currentContent = inputPath;
      }
    }

    // Walk nodes
    for (const node of ordered) {
      const data = node.data as unknown as NodeData;
      await log(
        `Processing node [${node.type}] ${(data as Record<string, unknown>).label ?? node.id}`
      );

      // ── Input nodes ──────────────────────────────────────────────────────
      if (node.type === "folder") {
        const p = data.folderPath ?? "";
        if (p) {
          inputPath = p;
          currentContent = p;
          await log(`Input folder: ${p}`);
        }
        continue;
      }

      if (node.type === "code-file") {
        const p = data.filePath ?? "";
        if (p && existsSync(p)) {
          inputPath = p;
          currentContent = await readFile(p, "utf8");
          await log(`Read code file: ${p} (${currentContent.length} chars)`);
        }
        continue;
      }

      // ── Output nodes ─────────────────────────────────────────────────────
      if (node.type === "output-local-path") {
        outputLocalPath = data.localPath ?? "";
        await log(`Output path set: ${outputLocalPath}`);
        // Write the current content to the output path
        if (outputLocalPath && currentContent) {
          await mkdir(dirname(outputLocalPath), { recursive: true });
          await writeFile(outputLocalPath, currentContent, "utf8");
          await log(`Wrote output to: ${outputLocalPath} (${currentContent.length} chars)`);
        }
        continue;
      }

      // ── Operation nodes ──────────────────────────────────────────────────
      if (node.type === "operation") {
        const operationId = data.operationId ?? "";
        const operation = operationsMap.get(operationId);

        if (!operation) {
          await log(`WARNING: Operation ${operationId} not found, skipping`);
          continue;
        }

        let config: OperationConfig = {};
        try {
          config = JSON.parse(operation.config) as OperationConfig;
        } catch {
          await log(`WARNING: Could not parse config for operation ${operation.name}, skipping`);
          continue;
        }

        const executor = config.executor;
        if (!executor) {
          await log(`WARNING: No executor configured for operation "${operation.name}", skipping`);
          continue;
        }

        await log(`Executing operation "${operation.name}" (${executor.type})`);

        if (executor.type === "script") {
          currentContent = await runScript(executor, inputPath, currentContent);
          await log(`Script output (${currentContent.length} chars)`);
        } else if (executor.type === "prompt") {
          currentContent = await runPrompt(executor, currentContent);
          await log(`Prompt output (${currentContent.length} chars)`);
        } else if (executor.type === "skill") {
          await log(`Skill executor not yet supported for operation "${operation.name}", skipping`);
        }

        continue;
      }

      // Skip other node types (github-project, condition, output-project-path)
      await log(`Skipped node type: ${node.type}`);
    }

    const summary = outputLocalPath
      ? `Output written to ${outputLocalPath}`
      : `Completed (no output-local-path node configured)`;

    await jobsDao.updateStatus(jobId, "done", {
      finishedAt: Date.now(),
      result: { output: currentContent.slice(0, 2000), summary },
    });
    await log(`Pipeline complete. ${summary}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await log(`ERROR: ${message}`);
    await jobsDao.updateStatus(jobId, "failed", {
      finishedAt: Date.now(),
      error: message,
    });
  }
};
