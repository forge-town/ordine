import {
  NODE_CONNECTION_RULES,
  type NodeConnectionRulesSchema,
} from "@repo/pipeline-engine/schemas";
import type { OperationRecord } from "@repo/db-schema";
import type { z } from "zod/v4";

export const getAllowedConnections = (
  _operations?: OperationRecord[]
): z.infer<typeof NodeConnectionRulesSchema> => NODE_CONNECTION_RULES;
