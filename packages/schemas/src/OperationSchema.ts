import { z } from "zod/v4";
import { OBJECT_TYPES } from "@repo/db-schema";
import {
  ExecutorConfigSchema,
  ExecutorTypeSchema,
  AgentModeSchema,
  ScriptLanguageSchema,
  OperationConfigSchema,
} from "@repo/pipeline-engine";

export {
  ExecutorConfigSchema,
  ExecutorTypeSchema,
  AgentModeSchema,
  ScriptLanguageSchema,
  OperationConfigSchema,
};
export type {
  ExecutorConfig,
  ExecutorType,
  AgentMode,
  ScriptLanguage,
  OperationConfig,
} from "@repo/pipeline-engine";

export const ObjectTypeSchema = z.enum(OBJECT_TYPES);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;
