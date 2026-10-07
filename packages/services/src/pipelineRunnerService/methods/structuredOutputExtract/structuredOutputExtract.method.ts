import { z } from "zod/v4";

import { extractJsonFromText, OperationOutputSchema } from "@repo/agent";
import { logger } from "@repo/logger";

import type { StructuredOutputAssemblyBindings } from "../../contracts";
export const createStructuredOutputExtractMethod =
  (serviceBindings: Pick<StructuredOutputAssemblyBindings, "tryParseJson">) =>
  ({ rawText }: { rawText: string }): string => {
    // Generic extraction (direct / fenced / first-brace substring) goes through the
    // shared extractJsonFromText; the check/fix "type" fallback match and the
    // OperationOutputSchema validation below are kept as-is.
    const candidate = extractJsonFromText(rawText);

    const parsed =
      (0, serviceBindings.tryParseJson)({ text: candidate }) ??
      (() => {
        const objectMatch = rawText.match(/\{[\s\S]*"type"\s*:\s*"(?:check|fix)"[\s\S]*\}/);
        if (objectMatch) return (0, serviceBindings.tryParseJson)({ text: objectMatch[0] });

        return undefined;
      })();

    if (parsed === undefined) {
      logger.warn("No valid JSON found in agent output — returning raw text");

      return rawText;
    }

    const result = OperationOutputSchema.safeParse(parsed);
    if (result.success) {
      logger.info(
        {
          type: result.data.type,
          count:
            result.data.type === "check" ? result.data.findings.length : result.data.changes.length,
        },
        "Validated structured output",
      );

      return JSON.stringify(result.data, null, 2);
    }

    logger.warn(
      { error: z.prettifyError(result.error) },
      "JSON parsed but schema validation failed — returning raw text",
    );

    return rawText;
  };
