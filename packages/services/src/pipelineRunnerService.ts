/**
 * Pipeline runner service — thin orchestration layer.
 *
 * Loads data from DAOs, wires up dependencies, and delegates
 * all execution logic to @repo/pipeline-engine.
 */

import { streamText } from "ai";
import { ResultAsync } from "neverthrow";
import { runPrompt as runPromptAgent } from "./promptExecutor.js";
import { runSkill as runSkillAgent } from "./skillExecutor.js";
import { structuredJsonToMarkdown } from "./structuredOutput.js";
import {
  createOperationsDao,
  createPipelinesDao,
  createJobsDao,
  createSkillsDao,
  createBestPracticesDao,
  createSettingsDao,
  createRulesDao,
} from "@repo/models";
import { db } from "@repo/db";
import { listDirTree, readProjectFiles } from "./filesystemService.js";
import { createLlmService } from "./llmService.js";
import { runRuleCheck } from "./ruleCheckRunner.js";
import {
  executePipeline,
  ScriptExecutionError,
  type PipelineEngineDeps,
  type PipelineRunError,
  type OperationInfo,
} from "@repo/pipeline-engine";

const operationsDao = createOperationsDao(db);
const pipelinesDao = createPipelinesDao(db);
const jobsDao = createJobsDao(db);
const skillsDao = createSkillsDao(db);
const bestPracticesDao = createBestPracticesDao(db);
const settingsDao = createSettingsDao(db);
const rulesDao = createRulesDao(db);
const llmService = createLlmService(settingsDao);
const getSettings = llmService.getSettings;
const getModel = llmService.getModel;

export const runPipeline = async (opts: {
  pipelineId: string;
  inputPath?: string;
  jobId: string;
  githubToken?: string;
}): Promise<void> => {
  const { pipelineId, jobId, githubToken } = opts;

  const log = async (line: string) => {
    await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ${line}`);
  };

  await jobsDao.updateStatus(jobId, "running", { startedAt: new Date() });
  await log(`Starting pipeline ${pipelineId}`);

  const pipeline = await pipelinesDao.findById(pipelineId);
  if (!pipeline) {
    await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ERROR: Pipeline ${pipelineId} not found`);
    await jobsDao.updateStatus(jobId, "failed", {
      finishedAt: new Date(),
      error: `Pipeline ${pipelineId} not found`,
    });
    return;
  }

  const operationIds = pipeline.nodes
    .filter((n) => n.type === "operation")
    .map((n) => (n.data as unknown as { operationId?: string }).operationId)
    .filter((id): id is string => id !== undefined && id !== null && id !== "");

  const operationsMap = new Map<string, OperationInfo>();
  for (const id of operationIds) {
    const op = await operationsDao.findById(id);
    if (op) operationsMap.set(id, { id: op.id, name: op.name, config: op.config });
  }

  const evaluateLoopCondition = async (
    conditionPrompt: string,
    operationOutput: string,
    modelOverride?: string,
  ): Promise<boolean> => {
    const model = await getModel(modelOverride);
    if (!model) {
      await log(`[Loop] No LLM configured — treating condition as PASS`);
      return true;
    }
    const evalPrompt = `You are a strict evaluator. Given the following acceptance criteria and the operation output, determine if the output meets the criteria.

## Acceptance Criteria
${conditionPrompt}

## Operation Output
${operationOutput}

Respond with EXACTLY one word: "PASS" if the criteria are met, or "FAIL" if not. Do not explain.`;

    const result = streamText({ model, prompt: evalPrompt });
    const chunks: string[] = [];
    for await (const chunk of result.textStream) {
      chunks.push(chunk);
    }
    const verdict = chunks.join("").trim().toUpperCase();
    await log(`[Loop] Condition evaluation result: ${verdict}`);
    return verdict.startsWith("PASS");
  };

  const deps: PipelineEngineDeps = {
    runPrompt: (o) =>
      runPromptAgent({
        ...o,
        getSettings,
      }),
    runSkill: (o) =>
      runSkillAgent({
        ...o,
        getSettings,
      }),
    runRuleCheck: (inputPath) => runRuleCheck(rulesDao, inputPath),
    structuredJsonToMarkdown,
    listDirTree,
    readProjectFiles,
    evaluateLoopCondition,
    log,
  };

  const lookupSkill = async (skillId: string) => {
    const skill = (await skillsDao.findById(skillId)) ?? (await skillsDao.findByName(skillId));
    return skill ? { id: skill.id, label: skill.label, description: skill.description } : null;
  };

  const lookupBestPractice = async (bpId: string) => {
    const bp = await bestPracticesDao.findById(bpId);
    return bp ? { title: bp.title, content: bp.content } : null;
  };

  const result = await ResultAsync.fromPromise(
    executePipeline({
      pipeline: {
        id: pipeline.id,
        name: pipeline.name,
        nodes: pipeline.nodes,
        edges: pipeline.edges,
      },
      jobId,
      inputPath: opts.inputPath,
      githubToken,
      operations: operationsMap,
      deps,
      lookupSkill,
      lookupBestPractice,
    }),
    (cause) =>
      new ScriptExecutionError(
        cause instanceof Error ? cause.message : String(cause),
        cause,
      ) as PipelineRunError,
  );

  const outcome = result.isOk() ? result.value : { ok: false as const, error: result.error };

  if (outcome.ok) {
    await jobsDao.updateStatus(jobId, "done", {
      finishedAt: new Date(),
      result: { summary: outcome.summary },
    });
  } else {
    const message = outcome.error.message;
    await jobsDao.appendLog(jobId, `[${new Date().toISOString()}] ERROR: ${message}`);
    await jobsDao.updateStatus(jobId, "failed", {
      finishedAt: new Date(),
      error: message,
    });
  }
};
