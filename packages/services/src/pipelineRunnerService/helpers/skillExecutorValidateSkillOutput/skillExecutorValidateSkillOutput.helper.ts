import { extractJsonFromText, CheckOutputSchema, FixOutputSchema } from "@repo/agent";
import { logger } from "@repo/logger";

import type { SkillExecutorAssemblyBindings } from "../../contracts";
export const createSkillExecutorValidateSkillOutputHelper =
  (_serviceBindings: Pick<SkillExecutorAssemblyBindings, never>) =>
  ({ raw }: { raw: string }): string => {
    const json = extractJsonFromText(raw);
    const parsedJson = JSON.parse(json);
    const checkParsed = CheckOutputSchema.safeParse(parsedJson);
    if (checkParsed.success) {
      logger.info({ len: json.length }, "runSkill: valid report");

      return json;
    }
    const fixParsed = FixOutputSchema.safeParse(parsedJson);
    if (fixParsed.success) {
      logger.info({ len: json.length }, "runSkill: valid report");

      return json;
    }
    logger.warn(
      { checkErrors: checkParsed.error, fixErrors: fixParsed.error },
      "runSkill: schema validation failed, using raw",
    );

    return json;
  };
