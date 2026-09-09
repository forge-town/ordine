import { isDeepStrictEqual } from "node:util";
import type { ExecutionCondition, ExecutionError, ExecutionValue } from "@repo/schemas";
import { err, ok, type Result } from "neverthrow";
import {
  isEmptyInlineValue,
  lookupArtifact,
  type ArtifactMetadataLookup,
} from "./validatePortValues";

export const evaluateExecutionCondition = async (
  condition: ExecutionCondition,
  values: ExecutionValue[],
  getArtifact: ArtifactMetadataLookup,
): Promise<Result<boolean, ExecutionError>> => {
  const state = { matches: false };
  for (const value of values) {
    if (condition.operator === "equals")
      state.matches = isDeepStrictEqual(value, condition.expected);
    else if (condition.operator === "contains")
      state.matches = value.kind === "text" && value.value.includes(condition.expected);
    else if (value.kind === "artifact") {
      const metadata = await lookupArtifact(value.artifactId, getArtifact);
      if (metadata.isErr()) return err(metadata.error);
      state.matches = metadata.value.sizeBytes > 0;
    } else state.matches = !isEmptyInlineValue(value);
    if (state.matches) break;
  }

  return ok(condition.negate ? !state.matches : state.matches);
};
