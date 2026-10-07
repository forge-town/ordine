import { extractJsonFromText } from "@repo/agent";
import { Result } from "neverthrow";
import type { z } from "zod/v4";

const parseJson = Result.fromThrowable(
  (value: string) => JSON.parse(value) as unknown,
  () => undefined,
);

const extractTopLevelJsonObjects = (source: string): string[] => {
  const state = {
    depth: 0,
    escaped: false,
    inString: false,
    start: -1,
  };
  const objects: string[] = [];

  for (const index of Array.from({ length: source.length }, (_, index) => index)) {
    const character = source[index];
    if (state.inString) {
      if (state.escaped) {
        state.escaped = false;
      } else if (character === "\\") {
        state.escaped = true;
      } else if (character === '"') {
        state.inString = false;
      }
      continue;
    }

    if (character === '"') {
      state.inString = true;
      continue;
    }
    if (character === "{") {
      if (state.depth === 0) state.start = index;
      state.depth += 1;
      continue;
    }
    if (character !== "}" || state.depth === 0) continue;

    state.depth -= 1;
    if (state.depth === 0 && state.start >= 0) {
      objects.push(source.slice(state.start, index + 1));
      state.start = -1;
    }
  }

  return objects;
};

export const parsePlanningResult = <T>(raw: string, schema: z.ZodType<T>): T => {
  const candidates = extractTopLevelJsonObjects(raw).reverse();
  for (const candidate of candidates) {
    const decoded = parseJson(candidate);
    if (decoded.isErr()) continue;
    const parsed = schema.safeParse(decoded.value);
    if (parsed.success) return parsed.data;
  }

  return schema.parse(JSON.parse(extractJsonFromText(raw)));
};
