import { Result } from "neverthrow";

const safeJsonParse = Result.fromThrowable(
  (text: string) => JSON.parse(text) as unknown,
  () => "invalid JSON",
);

/**
 * Extract JSON from text that may contain markdown fences or surrounding prose.
 * Order: direct parse → fenced code block → first `{...}` substring. On a hit,
 * returns the normalized JSON string with 2-space indentation; if everything
 * fails, returns the trimmed original text. Runtime-agnostic — the shared
 * utility for every consumer of structured LLM output.
 */
export const extractJsonFromText = (text: string): string => {
  const trimmed = text.trim();

  const direct = safeJsonParse(trimmed);
  if (direct.isOk()) return JSON.stringify(direct.value, null, 2);

  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)```/.exec(trimmed);
  if (fenceMatch?.[1]) {
    const fenced = safeJsonParse(fenceMatch[1].trim());
    if (fenced.isOk()) return JSON.stringify(fenced.value, null, 2);
  }

  const braceStart = trimmed.indexOf("{");
  const braceEnd = trimmed.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    const candidate = trimmed.slice(braceStart, braceEnd + 1);
    const braced = safeJsonParse(candidate);
    if (braced.isOk()) return JSON.stringify(braced.value, null, 2);
  }

  return trimmed;
};
