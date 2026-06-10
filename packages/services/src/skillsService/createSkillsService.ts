import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
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
import { Result, ResultAsync } from "neverthrow";
import { runAgent } from "../pipelineRunnerService/agentRunner/agentRunner";
import { normalizeSettingsRecord } from "../settingsService/normalizeSettingsRecord";

export interface SkillImportCandidate {
  id: string;
  name: string;
  label: string;
  description: string;
  path: string;
}

export interface SkillImportPreview {
  candidates: SkillImportCandidate[];
  errors: string[];
}

const SKILL_FILE_NAME = "SKILL.md";
const MAX_SCAN_DEPTH = 6;
const IMPORTED_CATEGORY = "imported";
const IMPORTED_TAG = "imported";
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

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const toLabel = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const parseFrontmatter = (content: string) => {
  if (!content.startsWith("---")) {
    return { fields: new Map<string, string>(), body: content.trim() };
  }

  const closeIndex = content.indexOf("\n---", 3);
  if (closeIndex < 0) {
    return { fields: new Map<string, string>(), body: content.trim() };
  }

  const frontmatterRaw = content.slice(3, closeIndex);
  const body = content.slice(closeIndex + 4).trim();
  const fields = new Map<string, string>();

  const lines = frontmatterRaw.split(/\r?\n/);
  const state = { index: 0 };
  while (state.index < lines.length) {
    const line = lines[state.index];
    if (!line) {
      state.index++;
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      state.index++;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      state.index++;
      continue;
    }

    if (rawValue === "|" || rawValue === ">") {
      const blockLines: string[] = [];
      const nextLine = lines[state.index + 1];
      const indentMatch = nextLine ? nextLine.match(/^(\s+)/) : null;
      const blockIndent = indentMatch && indentMatch[1] ? indentMatch[1].length : 2;
      state.index++;
      while (state.index < lines.length) {
        const blockLine = lines[state.index];
        if (!blockLine) {
          state.index++;
          continue;
        }
        if (blockLine.trim().length === 0) {
          blockLines.push("");
          state.index++;
          continue;
        }
        const spaceMatch = blockLine.match(/^(\s*)/);
        const leadingSpaces = spaceMatch && spaceMatch[1] ? spaceMatch[1].length : 0;
        if (leadingSpaces < blockIndent) break;
        blockLines.push(blockLine.slice(blockIndent));
        state.index++;
      }
      const value = blockLines.join("\n").trim();
      if (value) fields.set(key, value);
      continue;
    }

    const value = rawValue.replaceAll(/^["']|["']$/g, "");
    if (value) fields.set(key, value);
    state.index++;
  }

  return { fields, body };
};

const extractDescription = (body: string, frontmatterDescription?: string): string => {
  if (frontmatterDescription && frontmatterDescription.trim().length > 0) {
    return frontmatterDescription.trim();
  }

  const firstParagraph = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)[0];

  if (!firstParagraph) return "";

  return firstParagraph.replace(/^#{1,6}\s*/, "").trim();
};

const parseSkillFile = ({
  path,
  content,
}: {
  path: string;
  content: string;
}): SkillImportCandidate => {
  const { fields, body } = parseFrontmatter(content);
  const directoryName = basename(path.replace(/[/\\]SKILL\.md$/i, ""));
  const name = toSlug(fields.get("name") ?? directoryName) || `imported-skill-${randomUUID()}`;
  const description = extractDescription(body, fields.get("description"));

  return {
    id: `imported-${name}`,
    name,
    label: toLabel(name) || name,
    description: description || name,
    path,
  };
};

const scanSkillFiles = async ({
  rootPath,
  currentDepth = 0,
}: {
  rootPath: string;
  currentDepth?: number;
}): Promise<{ paths: string[]; errors: string[] }> => {
  if (currentDepth > MAX_SCAN_DEPTH) {
    return { paths: [], errors: [] };
  }

  const entriesResult = await ResultAsync.fromPromise(
    readdir(rootPath, { withFileTypes: true }),
    (error) => error,
  );

  if (entriesResult.isErr()) {
    return { paths: [], errors: [`Failed to read ${rootPath}: ${String(entriesResult.error)}`] };
  }

  const paths: string[] = [];
  const errors: string[] = [];
  for (const entry of entriesResult.value) {
    const entryPath = join(rootPath, entry.name);
    if (entry.isFile() && entry.name === SKILL_FILE_NAME) {
      paths.push(entryPath);
    }
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const child = await scanSkillFiles({ rootPath: entryPath, currentDepth: currentDepth + 1 });
      paths.push(...child.paths);
      errors.push(...child.errors);
    }
  }

  return { paths, errors };
};

export const createSkillsService = (db: DbConnection) => {
  const dao = createSkillsDao(db);
  const settingsDao = createSettingsDao(db);

  const buildFallback = (skill: Skill): SkillAnalysisResult => ({
    skillType: "single-step",
    steps: [{ name: skill.label, description: skill.description, suggestedOutputs: [] }],
    rationale: "Analysis failed; falling back to single-step",
  });

  const previewImport = async ({ rootPath }: { rootPath: string }): Promise<SkillImportPreview> => {
    const scanResult = await scanSkillFiles({ rootPath });
    const candidates: SkillImportCandidate[] = [];
    const errors = [...scanResult.errors];

    for (const path of scanResult.paths) {
      const contentResult = await ResultAsync.fromPromise(readFile(path, "utf8"), (error) => error);
      if (contentResult.isErr()) {
        errors.push(`Failed to read ${path}: ${String(contentResult.error)}`);
      } else {
        candidates.push(parseSkillFile({ path, content: contentResult.value }));
      }
    }

    return { candidates, errors };
  };

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    getByName: async (name: string) => withMeta(await dao.findByName(name)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
    seedIfEmpty: () => dao.seedIfEmpty(),
    buildDraftOperation: (skill: Skill) => buildDraftOperation(skill),
    previewImport,
    importCandidates: async (candidates: SkillImportCandidate[]) => {
      const imported = [];
      for (const candidate of candidates) {
        const existing = await dao.findByName(candidate.name);
        if (existing) {
          const updated = await dao.update(existing.id, {
            label: candidate.label,
            description: candidate.description,
            category: IMPORTED_CATEGORY,
            tags: existing.tags.includes(IMPORTED_TAG)
              ? existing.tags
              : [...existing.tags, IMPORTED_TAG],
          });
          if (updated) imported.push(updated);
        } else {
          imported.push(await dao.create({
            id: candidate.id,
            name: candidate.name,
            label: candidate.label,
            description: candidate.description,
            category: IMPORTED_CATEGORY,
            tags: [IMPORTED_TAG],
          }));
        }
      }

      return mapWithMeta(imported);
    },
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
