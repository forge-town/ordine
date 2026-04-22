import {
  NODE_CONNECTION_RULES,
  type NodeConnectionRulesSchema,
} from "@repo/pipeline-engine/schemas";
import type { Operation } from "@repo/schemas";
import type { z } from "zod/v4";

export const getAllowedConnections = (
  _operations?: Operation[]
): z.infer<typeof NodeConnectionRulesSchema> => NODE_CONNECTION_RULES;
