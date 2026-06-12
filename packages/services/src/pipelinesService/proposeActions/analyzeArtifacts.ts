import { logger } from "@repo/logger";
import type { ArtifactAnalysis, ProposeAttachment } from "@repo/schemas";
import { truncate } from "../promptText";
import type { ProposeOperationCatalogItem } from "./buildProposePrompt";
import { runProposeAgent, type RunProposeAgentOptions } from "./runProposeAgent";

export const ANALYZE_AGENT_ID = "pipeline-analyze-artifacts";

const MAX_ANALYZE_CONTENT_CHARS = 32_000;

export const ANALYZE_SYSTEM_PROMPT = [
  "You are the first stage of a reverse-engineering pipeline assistant for Ordine.",
  "You receive FINISHED OUTPUT artifacts (their real content) plus the user's goal.",
  "Your only job is to analyze the artifacts — a second stage will draft the pipeline from your analysis.",
  "",
  "Return ONLY a JSON object with this exact schema:",
  "{",
  '  "structure": "<concise description of the artifact structure: sections, fields, formats, counts>",',
  '  "steps": ["<ordered upstream step that must have produced this output>", ...],',
  '  "matchedComponentIds": ["<id from AVAILABLE OPERATIONS that covers one of the steps>", ...]',
  "}",
  "",
  "Rules:",
  "- Ground 'structure' in the actual CONTENT (headings, data shapes, counts) — never just the filename.",
  "- 'steps' is the minimal ordered set of transformations from raw input to this artifact (3-7 entries).",
  "- 'matchedComponentIds' may be empty; only include ids that genuinely match a step.",
  "- Return ONLY the JSON object. No markdown, no code fences.",
].join("\n");

export type BuildAnalyzeUserPromptInput = {
  attachments: ProposeAttachment[];
  message: string;
  operationCatalog: ProposeOperationCatalogItem[];
};

export const buildAnalyzeUserPrompt = ({
  attachments,
  message,
  operationCatalog,
}: BuildAnalyzeUserPromptInput): string =>
  [
    "=== USER GOAL ===",
    message,
    "",
    `=== AVAILABLE OPERATIONS (${operationCatalog.length}) ===`,
    truncate(JSON.stringify(operationCatalog, null, 2), MAX_ANALYZE_CONTENT_CHARS),
    "",
    "=== ARTIFACTS ===",
    ...attachments.flatMap((attachment, index) => [
      `Artifact ${index + 1}: ${attachment.name}${attachment.type ? ` (${attachment.type})` : ""}`,
      ...(attachment.content
        ? ["--- content start ---", truncate(attachment.content, MAX_ANALYZE_CONTENT_CHARS), "--- content end ---"]
        : ["(binary — filename only)"]),
      "",
    ]),
    "Analyze the artifacts now. Return ONLY the JSON object.",
  ].join("\n");

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** 宽松解析第一段输出；缺 structure 视为无效（分析失败不阻塞主链路）。 */
export const parseArtifactAnalysis = (json: unknown): ArtifactAnalysis | undefined => {
  if (typeof json !== "object" || json === null) {
    return undefined;
  }

  const record = json as Record<string, unknown>;
  if (typeof record.structure !== "string" || record.structure.trim().length === 0) {
    return undefined;
  }

  return {
    matchedComponentIds: toStringArray(record.matchedComponentIds),
    steps: toStringArray(record.steps),
    structure: record.structure,
  };
};

export type AnalyzeArtifactsOptions = Pick<
  RunProposeAgentOptions,
  "agent" | "apiKey" | "model" | "ssh"
> &
  BuildAnalyzeUserPromptInput;

/**
 * N14-02 第一段：读样本结构 / 推上游步骤 / 匹配既有算子。
 * 失败时返回 undefined——第二段照常运行，只是没有 ARTIFACT ANALYSIS 段；
 * 绝不伪造分析结果（手册警告 4）。
 */
export const analyzeArtifacts = async (
  opts: AnalyzeArtifactsOptions,
): Promise<ArtifactAnalysis | undefined> => {
  const result = await runProposeAgent({
    agent: opts.agent,
    agentId: ANALYZE_AGENT_ID,
    apiKey: opts.apiKey,
    logPrefix: "analyzeArtifacts",
    model: opts.model,
    ssh: opts.ssh,
    systemPrompt: ANALYZE_SYSTEM_PROMPT,
    userPrompt: buildAnalyzeUserPrompt(opts),
  });

  if (!result.ok) {
    logger.warn({ code: result.code, detail: result.detail }, "analyzeArtifacts: stage one failed");

    return undefined;
  }

  const analysis = parseArtifactAnalysis(result.json);
  if (!analysis) {
    logger.warn({ json: result.json }, "analyzeArtifacts: unparsable stage-one output");
  }

  return analysis;
};
