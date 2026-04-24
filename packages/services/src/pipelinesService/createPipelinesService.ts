import { ResultAsync } from "neverthrow";
import {
  createDistillationsDao,
  createJobsDao,
  createJobTracesDao,
  createAgentRawExportsDao,
  createAgentSpansDao,
  createOperationsDao,
  createPipelinesDao,
  createSettingsDao,
  type DbConnection,
} from "@repo/models";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { PipelineSchema, type PipelineData } from "@repo/pipeline-engine/schemas";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";

const OPTIMIZE_AGENT_ID = "pipeline-optimizer";

const OPTIMIZE_SYSTEM_PROMPT = [
  "You are a pipeline optimization agent for Ordine, an AI-first pipeline orchestration platform.",
  "Your job is to generate an IMPROVED pipeline based on a distillation report from a previous run.",
  "",
  "=== YOUR PRIMARY DIRECTIVE ===",
  "The distillation report contains structured analysis of what went wrong and how to fix it.",
  "You MUST treat these fields as MANDATORY REQUIREMENTS, not suggestions:",
  "",
  "1. **nextActions**: These are specific, actionable fixes. Implement ALL of them in the new pipeline.",
  "   - If it says 'add output node' → the new pipeline must have an output node",
  "   - If it says 'replace LLM with API call' → restructure the pipeline to use fewer/no agent nodes",
  "   - If it says 'split into multiple steps' → add more operation nodes in the chain",
  "",
  "2. **minimalPath**: This is the IDEAL execution path. Design the new pipeline to follow this flow.",
  "   Map each step in minimalPath to a concrete node in the pipeline.",
  "",
  "3. **insights**: These explain WHY the original pipeline was suboptimal.",
  "   Use insights to inform your design decisions (e.g., reduce token usage, fix error patterns).",
  "",
  "4. **reusableAssets**: These are ready-made building blocks.",
  "   If a reusable asset provides a pipeline template, use it as your starting blueprint.",
  "",
  "=== OUTPUT SCHEMA ===",
  '{ "id": "<short_id>", "name": "string", "description": "string", "tags": ["string"],',
  '  "timeoutMs": null, "nodes": [PipelineNode], "edges": [PipelineEdge] }',
  "",
  "=== NODE TYPES ===",
  "",
  "1. INPUT — github-project:",
  '{ "id": "<unique>", "type": "github-project", "position": {"x":0,"y":0},',
  '  "data": { "nodeType": "github-project", "label": "...", "owner": "<github-owner>",',
  '    "repo": "<repo-name>", "branch": "main", "sourceType": "github",',
  '    "accessMode": "remote", "disclosureMode": "tree" } }',
  "",
  "2. INPUT — folder:",
  '{ "id": "<unique>", "type": "folder", "position": {"x":0,"y":0},',
  '  "data": { "nodeType": "folder", "label": "...", "folderPath": "/path/to/folder" } }',
  "",
  "3. OPERATION — processing step:",
  '{ "id": "<unique>", "type": "operation", "position": {"x":0,"y":<step*200>},',
  '  "data": { "nodeType": "operation", "label": "...", "operationId": "<from list>",',
  '    "operationName": "<from list>", "status": "idle" } }',
  "",
  "4. OUTPUT — output-local-path:",
  '{ "id": "<unique>", "type": "output-local-path", "position": {"x":0,"y":<last>},',
  '  "data": { "nodeType": "output-local-path", "label": "Output",',
  '    "localPath": "/tmp/ordine-output" } }',
  "",
  "Each edge: { \"id\": \"<unique>\", \"source\": \"<nodeId>\", \"target\": \"<nodeId>\" }",
  "",
  "=== STRUCTURAL RULES ===",
  "- Pipeline MUST have at least 1 input node (github-project or folder)",
  "- Pipeline MUST have at least 1 output node (output-local-path)",
  "- Pipeline MUST have a complete path: input → operation(s) → output",
  "- Use ONLY operations from the provided operations list (match by id and name)",
  "- For github-project nodes: sourceType MUST be \"github\" or \"local\" (NOT \"remote\")",
  "- Infer input node type and details from the original pipeline and job context",
  "- Arrange nodes top to bottom with ~200px vertical spacing",
  "",
  "=== OPTIMIZATION PRINCIPLES ===",
  "- If the distillation says token/cost is too high, REDUCE the number of LLM agent nodes",
  "- If the distillation says runtime is too slow, SPLIT work into parallel branches or use simpler ops",
  "- If the distillation says output was lost, ADD output-local-path nodes",
  "- If a minimalPath step doesn't map to an existing operation, pick the closest available one",
  "- Preserve the original pipeline's input sources (same repo, same folder) but optimize the processing",
  "- The description MUST explain WHAT was optimized and WHY, referencing specific distillation insights",
  "",
  "=== OPERATION SELECTION RULES ===",
  "- ONLY use operations whose purpose logically matches the pipeline's task",
  "- Check each operation's acceptedObjectTypes — it must accept the type flowing from the previous node",
  "  - github-project nodes produce 'project' type",
  "  - folder nodes produce 'folder' type",
  "  - code-file nodes produce 'file' or 'code-file' type",
  "- Do NOT add extra operations just to fill space. If only 1 operation is relevant, use only 1",
  "- If the minimalPath suggests a step but no matching operation exists, SKIP that step rather than picking an unrelated operation",
  "- Prefer reusing the SAME operations from the original pipeline unless the distillation explicitly says to replace them",
  "",
  "Return ONLY the JSON object. No markdown, no explanation, no code fences.",
].join("\n");

const MAX_SNAPSHOT_CHARS = 20_000;
const truncate = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max)}\n... (truncated)`;

export const createPipelinesService = (db: DbConnection) => {
  const dao = createPipelinesDao(db);
  const distillationsDao = createDistillationsDao(db);
  const jobsDao = createJobsDao(db);
  const jobTracesDao = createJobTracesDao(db);
  const agentRawExportsDao = createAgentRawExportsDao(db);
  const agentSpansDao = createAgentSpansDao(db);
  const operationsDao = createOperationsDao(db);
  const settingsDao = createSettingsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),

    optimizeFromDistillation: async (opts: {
      distillationId: string;
      userPrompt: string;
    }): Promise<PipelineData | undefined> => {
      const distillationRecord = await distillationsDao.findById(opts.distillationId);
      if (!distillationRecord) return undefined;

      const settings = normalizeSettingsRecord(await settingsDao.get());
      const operations = await operationsDao.findMany();

      let jobContext = "";
      let sourcePipelineContext = "";
      if (distillationRecord.sourceType === "job" && distillationRecord.sourceId) {
        const [job, traces] = await Promise.all([
          jobsDao.findById(distillationRecord.sourceId),
          jobTracesDao.findByJobId(distillationRecord.sourceId),
        ]);
        jobContext = [
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

        if (job?.pipelineId) {
          const sourcePipeline = await dao.findById(job.pipelineId);
          if (sourcePipeline) {
            sourcePipelineContext = [
              "Original Pipeline (use this as reference for input/output nodes):",
              truncate(JSON.stringify(sourcePipeline, null, 2), MAX_SNAPSHOT_CHARS),
            ].join("\n");
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
        sourcePipelineContext || "(no source pipeline found)",
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
        jobContext ? `Source job context:\n${jobContext}` : "",
        "",
        "Generate the optimized pipeline JSON now. Return ONLY the JSON.",
      ].join("\n");

      const MAX_RETRIES = 3;
      let execution: Awaited<ReturnType<typeof ResultAsync.fromPromise<string, Error>>> | undefined;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        execution = await ResultAsync.fromPromise(
          runAgent({
            agent: settings.defaultAgentRuntime,
            systemPrompt: OPTIMIZE_SYSTEM_PROMPT,
            userPrompt: userPromptText,
            inputPath: process.cwd(),
            agentId: OPTIMIZE_AGENT_ID,
            allowedTools: [],
            logPrefix: "optimizePipeline",
            apiKey: settings.defaultApiKey,
            model: settings.defaultModel,
          }),
          (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
        );
        if (execution.isOk()) break;
        logger.warn({ attempt, err: execution.error.message }, "optimizePipeline: agent attempt failed, retrying");
      }

      if (!execution || execution.isErr()) {
        logger.error({ err: execution?.error }, "optimizePipeline: agent failed after retries");
        return undefined;
      }

      const raw = execution.value;
      const json = extractJsonFromText(raw);
      const rawParsed = JSON.parse(json);

      // Sanitize known LLM output issues before Zod validation
      if (Array.isArray(rawParsed.nodes)) {
        for (const node of rawParsed.nodes) {
          if (node.data?.nodeType === "github-project" && node.data.sourceType === "remote") {
            node.data.sourceType = "github";
          }
        }
      }

      // Ensure unique ID to avoid collisions with existing pipelines
      const existingPipeline = await dao.findById(rawParsed.id);
      if (existingPipeline) {
        rawParsed.id = `${rawParsed.id}_${Date.now()}`;
      }

      const parsed = PipelineSchema.omit({ createdAt: true, updatedAt: true }).safeParse(
        rawParsed,
      );

      if (!parsed.success) {
        logger.error({ error: parsed.error }, "optimizePipeline: invalid pipeline JSON from agent");
        return undefined;
      }

      const created = await dao.create({
        ...parsed.data,
        nodes: parsed.data.nodes as never,
        edges: parsed.data.edges as never,
      });

      return created;
    },
  };
};
