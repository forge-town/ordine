import type { Distillation } from "@repo/schemas";

const MAX_PROMPT_SNAPSHOT_CHARS = 30_000;

const DISTILLATION_RESULT_EXAMPLE = {
  type: "completed" as const,
  summary: "Concise statement of what the source material reveals.",
  insights: ["Key insight 1", "Key insight 2"],
  minimalPath: ["Step 1", "Step 2"],
  reusableAssets: [
    {
      type: "pipeline_template" as const,
      title: "Reusable template name",
      content: "Template, patch, or knowledge card content.",
    },
  ],
  nextActions: ["Concrete next action 1", "Concrete next action 2"],
};

export const DEFAULT_DISTILLATION_SYSTEM_PROMPT = [
  "You are a strict distillation agent.",
  "Transform raw source material into reusable structured insight.",
  "Prefer concrete evidence, extract the minimum viable path, and avoid filler.",
  "Return only JSON that exactly matches the requested schema.",
].join("\n");

const MODE_GUIDANCE: Record<Distillation["mode"], string> = {
  pipeline:
    "Identify the critical path, noisy steps, reusable pipeline pattern, and concrete optimization actions.",
  failure:
    "Identify the failure pattern, root causes, anti-patterns, and guardrails that prevent recurrence.",
  prompt:
    "Identify the effective prompting pattern, what should be removed, and the most reusable prompt assets.",
  knowledge: "Extract the durable knowledge units, patterns, and the most reusable takeaways.",
};

export const stringifyForPrompt = (value: unknown): string => {
  const text = JSON.stringify(value, null, 2);
  if (text.length <= MAX_PROMPT_SNAPSHOT_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_PROMPT_SNAPSHOT_CHARS)}\n... (truncated)`;
};

export const buildDistillationUserPrompt = ({
  distillation,
  sourceSnapshot,
}: {
  distillation: Distillation;
  sourceSnapshot: unknown;
}) => {
  return [
    `Distillation title: ${distillation.title}`,
    `Mode: ${distillation.mode}`,
    `Source type: ${distillation.sourceType}`,
    `Source label: ${distillation.sourceLabel || "—"}`,
    `Existing summary: ${distillation.summary || "—"}`,
    `Objective: ${distillation.config.objective || "Extract the most reusable insight."}`,
    "",
    "Focus guidance:",
    MODE_GUIDANCE[distillation.mode],
    "",
    "Return ONLY a JSON object matching this exact shape:",
    JSON.stringify(DISTILLATION_RESULT_EXAMPLE, null, 2),
    "",
    "Source snapshot:",
    stringifyForPrompt(sourceSnapshot),
  ].join("\n");
};
