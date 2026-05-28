import { Result, ResultAsync } from "neverthrow";
import { createSkillsDao, createSettingsDao, type DbConnection } from "@repo/models";
import {
  mapWithMeta,
  withMeta,
  SkillAnalysisResultSchema,
  buildDraftOperation,
  type SkillAnalysisResult,
  type Skill,
} from "@repo/schemas";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";

const ANALYZE_SKILL_SYSTEM_PROMPT = [
  "You are an AI workflow analyst. Analyze the given skill description and determine whether it represents a single-step task or a multi-step long SOP (Standard Operating Procedure).",
  "",
  "=== OUTPUT SCHEMA ===",
  JSON.stringify({
    skillType: "single-step | multi-step",
    steps: [
      {
        name: "Step name (concise, 2-5 words)",
        description: "What this step does in 1-2 sentences",
        suggestedOutputs: [
          { name: "output name", contentType: "markdown | json | yaml | text | html | xml | csv" },
        ],
      },
    ],
    rationale: "Brief explanation of why you classified it this way",
  }, null, 2),
  "",
  "Rules:",
  "- If the skill is a simple, atomic task (e.g. 'check code style', 'generate a component'), return skillType='single-step' with 1 step.",
  "- If the skill describes a complex workflow with multiple phases, decisions, or sequential tasks (e.g. 'implement a feature end-to-end', 'orchestrate subagents'), return skillType='multi-step' and break it into 2-8 concrete steps.",
  "- Each step must be independently executable as an Operation.",
  "- suggestedOutputs is optional per step; only include if the step clearly produces a deliverable.",
  "- Return ONLY the JSON object. No markdown, no explanation, no code fences.",
].join("\n");

export const createSkillsService = (db: DbConnection) => {
  const dao = createSkillsDao(db);
  const settingsDao = createSettingsDao(db);

  const buildFallback = (skill: Skill): SkillAnalysisResult => ({
    skillType: "single-step",
    steps: [{ name: skill.label, description: skill.description, suggestedOutputs: [] }],
    rationale: "Analysis failed; falling back to single-step",
  });

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    getByName: async (name: string) => withMeta(await dao.findByName(name)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
    seedIfEmpty: () => dao.seedIfEmpty(),
    buildDraftOperation: (skill: Skill) => buildDraftOperation(skill),

    analyzeSkill: async (skill: Skill): Promise<SkillAnalysisResult> => {
      const settingsRecord = await settingsDao.get();
      const settings = normalizeSettingsRecord(settingsRecord);

      const userPrompt = [
        "=== SKILL TO ANALYZE ===",
        `Name: ${skill.label}`,
        `Description: ${skill.description}`,
        "",
        "Analyze this skill and return the JSON result.",
      ].join("\n");

      const agentResult = await ResultAsync.fromPromise(
        runAgent({
          agent: settings.defaultAgentRuntime,
          systemPrompt: ANALYZE_SKILL_SYSTEM_PROMPT,
          userPrompt,
          inputPath: process.cwd(),
          agentId: "skill-analyzer",
          allowedTools: [],
          logPrefix: "analyzeSkill",
          apiKey: settings.defaultApiKey,
          model: settings.defaultModel,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );

      if (agentResult.isErr()) {
        logger.error({ err: agentResult.error }, "analyzeSkill: agent failed");

        return buildFallback(skill);
      }

      const json = extractJsonFromText(agentResult.value);
      const parseResult = Result.fromThrowable(
        () => JSON.parse(json) as unknown,
        () => new Error("Invalid JSON"),
      )();

      if (parseResult.isErr()) {
        logger.error("analyzeSkill: failed to parse agent output");

        return buildFallback(skill);
      }

      const validated = SkillAnalysisResultSchema.safeParse(parseResult.value);
      if (!validated.success) {
        logger.error({ error: validated.error }, "analyzeSkill: schema validation failed");

        return buildFallback(skill);
      }

      return validated.data;
    },
  };
};
