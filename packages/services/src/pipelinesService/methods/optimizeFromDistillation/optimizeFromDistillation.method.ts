import "../../../text-imports.d.ts";

import { logger } from "@repo/logger";
import { PipelineSchema, type PipelineData } from "@repo/schemas";

import { runStructuredAgent } from "../../../pipelineRunnerService/helpers/runStructuredAgent/runStructuredAgent.helper";
import { normalizeSettingsRecord } from "../../../settingsService/helpers/normalizeSettingsRecord";

import { PIPELINE_CANVAS_SKILL_CONTEXT } from "../../helpers/pipelineCanvasSkillContext/pipelineCanvasSkillContext.helper";

import { MAX_SNAPSHOT_CHARS, truncate } from "../../helpers/promptText/promptText.helper";

import { buildOptimizeSystemPrompt, OPTIMIZE_AGENT_ID } from "../../helpers/prompts/prompts.helper";

import { expandTildeInNodes } from "../../helpers/expandTildeInNodes";

import type { PipelinesServiceBindings } from "../../contracts";
export const createOptimizeFromDistillationMethod =
  (
    serviceBindings: Pick<
      PipelinesServiceBindings,
      | "distillationsDao"
      | "settingsDao"
      | "operationsDao"
      | "jobsDao"
      | "jobTracesDao"
      | "pipelineRunsDao"
      | "dao"
    >,
  ) =>
  async (opts: {
    distillationId: string;
    userPrompt: string;
  }): Promise<PipelineData | undefined> => {
    const distillationRecord = await serviceBindings.distillationsDao.findById(opts.distillationId);
    if (!distillationRecord) return undefined;

    const settings = normalizeSettingsRecord(await serviceBindings.settingsDao.get());
    const operations = await serviceBindings.operationsDao.findMany();

    const context = { jobContext: "", sourcePipelineContext: "" };
    if (distillationRecord.sourceType === "job" && distillationRecord.sourceId) {
      const [job, traces] = await Promise.all([
        serviceBindings.jobsDao.findById(distillationRecord.sourceId),
        serviceBindings.jobTracesDao.findByJobId(distillationRecord.sourceId),
      ]);
      context.jobContext = [
        "Source Job:",
        truncate(JSON.stringify(job, null, 2), MAX_SNAPSHOT_CHARS),
        "",
        `Traces (${traces.length}):`,
        truncate(
          JSON.stringify(
            traces.slice(0, 40).map((t) => ({ level: t.level, message: t.message })),
            null,
            2,
          ),
          MAX_SNAPSHOT_CHARS,
        ),
      ].join("\n");

      if (job) {
        const pipelineRun = await serviceBindings.pipelineRunsDao.findByJobId(job.id);
        if (pipelineRun?.pipelineId) {
          const sourcePipeline = await serviceBindings.dao.findById(pipelineRun.pipelineId);
          if (sourcePipeline) {
            context.sourcePipelineContext = [
              "Original Pipeline (use this as reference for input/output nodes):",
              truncate(JSON.stringify(sourcePipeline, null, 2), MAX_SNAPSHOT_CHARS),
            ].join("\n");
          }
        }
      }
    }

    // Build structured distillation sections for the prompt
    const distResult = distillationRecord.result as Record<string, unknown> | null;
    const nextActions = Array.isArray(distResult?.nextActions)
      ? (distResult.nextActions as string[]).map((a, i) => `  ${i + 1}. ${a}`).join("\n")
      : "(none)";
    const minimalPath = Array.isArray(distResult?.minimalPath)
      ? (distResult.minimalPath as string[]).map((s, i) => `  ${i + 1}. ${s}`).join("\n")
      : "(none)";
    const insights = Array.isArray(distResult?.insights)
      ? (distResult.insights as string[]).map((s, i) => `  ${i + 1}. ${s}`).join("\n")
      : "(none)";
    const reusableAssets = Array.isArray(distResult?.reusableAssets)
      ? truncate(JSON.stringify(distResult.reusableAssets, null, 2), MAX_SNAPSHOT_CHARS)
      : "(none)";

    const userPromptText = [
      "=== REQUIRED ACTIONS (implement ALL of these) ===",
      nextActions,
      "",
      "=== OPTIMAL EXECUTION PATH (design pipeline to follow this) ===",
      minimalPath,
      "",
      "=== INSIGHTS (problems to fix) ===",
      insights,
      "",
      "=== REUSABLE ASSETS (use as blueprint if applicable) ===",
      reusableAssets,
      "",
      "=== ORIGINAL PIPELINE (preserve input sources, optimize processing) ===",
      context.sourcePipelineContext || "(no source pipeline found)",
      "",
      `=== AVAILABLE OPERATIONS (${operations.length}) ===`,
      JSON.stringify(
        operations.map((op) => ({
          id: op.id,
          name: op.name,
          description: op.description,
          acceptedObjectTypes: op.acceptedObjectTypes,
        })),
        null,
        2,
      ),
      "",
      "=== ADDITIONAL CONTEXT ===",
      `User guidance: ${opts.userPrompt}`,
      `Distillation summary: ${distResult?.summary ?? ""}`,
      "",
      context.jobContext ? `Source job context:\n${context.jobContext}` : "",
      "",
      "Generate the optimized pipeline JSON now. Return ONLY the JSON.",
    ].join("\n");

    const optimizePrompt = buildOptimizeSystemPrompt(PIPELINE_CANVAS_SKILL_CONTEXT);

    const structured = await runStructuredAgent({
      agent: settings.defaultAgentRuntime,
      systemPrompt: optimizePrompt,
      userPrompt: userPromptText,
      agentId: OPTIMIZE_AGENT_ID,
      logPrefix: "optimizePipeline",
      apiKey: settings.defaultApiKey,
      model: settings.defaultModel,
    });

    if (!structured.ok) {
      logger.error(
        { code: structured.code, detail: structured.detail },
        structured.code === "AGENT_FAILED"
          ? "optimizePipeline: agent failed after retries"
          : "optimizePipeline: agent returned invalid JSON",
      );

      return undefined;
    }

    const rawParsed = structured.json as {
      id: string;
      nodes?: Array<{ data: { nodeType?: string; sourceType?: string } }>;
    };

    // Sanitize known LLM output issues before Zod validation
    if (Array.isArray(rawParsed.nodes)) {
      for (const node of rawParsed.nodes) {
        if (node.data?.nodeType === "github-projects" && node.data.sourceType === "remote") {
          node.data.sourceType = "github";
        }
      }
    }

    // Ensure unique ID to avoid collisions with existing pipelines
    const existingPipeline = await serviceBindings.dao.findById(rawParsed.id);
    if (existingPipeline) {
      rawParsed.id = `${rawParsed.id}_${Date.now()}`;
    }

    const parsed = PipelineSchema.omit({ createdAt: true, updatedAt: true }).safeParse(rawParsed);

    if (!parsed.success) {
      logger.error({ error: parsed.error }, "optimizePipeline: invalid pipeline JSON from agent");

      return undefined;
    }

    const created = await serviceBindings.dao.create({
      ...parsed.data,
      nodes: expandTildeInNodes(parsed.data.nodes) as never,
      edges: parsed.data.edges as never,
    });

    return created;
  };
