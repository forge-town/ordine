/**
 * Pipeline runner service — thin orchestration layer.
 *
 * Loads data from DAOs, wires up dependencies, and delegates
 * all execution logic to @repo/pipeline-engine.
 */

import { streamText } from "ai";
import { ResultAsync } from "neverthrow";
import { runPrompt as runPromptAgent } from "./promptExecutor";
import { runSkill as runSkillAgent } from "./skillExecutor";
import { structuredJsonToMarkdown } from "./structuredOutput";
import type {
  OperationsDaoInstance,
  PipelinesDaoInstance,
  JobsDaoInstance,
  JobTracesDaoInstance,
  SkillsDaoInstance,
  BestPracticesDaoInstance,
  SettingsDaoInstance,
  RulesDaoInstance,
} from "@repo/models";
import { initObs, trace } from "@repo/obs";
import { listDirTree, readProjectFiles } from "./filesystemService";
import { createLlmService } from "./llmService";
import { runRuleCheck } from "./pipelineRunnerService/ruleCheckRunner";
import {
  pipelineEngine,
  ScriptExecutionError,
  type PipelineEngineDeps,
  type PipelineRunError,
  type OperationInfo,
} from "@repo/pipeline-engine";

export interface PipelineRunnerDeps {
  operationsDao: OperationsDaoInstance;
  pipelinesDao: PipelinesDaoInstance;
  jobsDao: JobsDaoInstance;
  jobTracesDao: JobTracesDaoInstance;
  skillsDao: SkillsDaoInstance;
  bestPracticesDao: BestPracticesDaoInstance;
  settingsDao: SettingsDaoInstance;
  rulesDao: RulesDaoInstance;
}

export const createPipelineRunnerService = (deps: PipelineRunnerDeps) => {
  const {
    operationsDao,
    pipelinesDao,
    jobsDao,
    jobTracesDao,
    skillsDao,
    bestPracticesDao,
    settingsDao,
    rulesDao,
  } = deps;

  initObs(jobTracesDao);
  const llmService = createLlmService(settingsDao);
  const getSettings = llmService.getSettings;
  const getModel = llmService.getModel;

  const runPipeline = async (opts: {
    pipelineId: string;
    inputPath?: string;
    jobId: string;
    githubToken?: string;
  }): Promise<void> => {
    const { pipelineId, jobId, githubToken } = opts;

    await jobsDao.updateStatus(jobId, "running", { startedAt: new Date() });
    await trace(jobId, `Starting pipeline ${pipelineId}`);

    const pipeline = await pipelinesDao.findById(pipelineId);
    if (!pipeline) {
      await trace(jobId, `ERROR: Pipeline ${pipelineId} not found`);
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
        await trace(jobId, `[Loop] No LLM configured — treating condition as PASS`);
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
      await trace(jobId, `[Loop] Condition evaluation result: ${verdict}`);
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
      pipelineEngine.execute({
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
      await trace(jobId, `ERROR: ${message}`, "error");
      await jobsDao.updateStatus(jobId, "failed", {
        finishedAt: new Date(),
        error: message,
      });
    }
  };

  const startRun = async (opts: {
    pipelineId: string;
    inputPath?: string;
    githubToken?: string;
  }): Promise<{ jobId: string }> => {
    const pipeline = await pipelinesDao.findById(opts.pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${opts.pipelineId} not found`);
    }

    const jobId = crypto.randomUUID();
    await jobsDao.create({
      id: jobId,
      title: `Run: ${pipeline.name}`,
      type: "pipeline_run",
      pipelineId: opts.pipelineId,
      projectId: null,
      logs: [],
      result: null,
      error: null,
      status: "queued",
      startedAt: null,
      finishedAt: null,
    });

    void runPipeline({
      pipelineId: opts.pipelineId,
      inputPath: opts.inputPath,
      githubToken: opts.githubToken,
      jobId,
    });

    return { jobId };
  };

  return { runPipeline, startRun };
};
