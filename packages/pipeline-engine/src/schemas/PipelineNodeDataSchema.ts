import { z } from "zod/v4";
import { CompoundNodeDataSchema } from "./CompoundNodeDataSchema.js";
import { ConditionNodeDataSchema } from "./ConditionNodeDataSchema.js";
import { CodeFileNodeDataSchema } from "./CodeFileNodeDataSchema.js";
import { FolderNodeDataSchema } from "./FolderNodeDataSchema.js";
import { GitHubProjectNodeDataSchema } from "./GitHubProjectNodeDataSchema.js";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema.js";
import { OutputProjectPathNodeDataSchema } from "./OutputProjectPathNodeDataSchema.js";
import { OutputLocalPathNodeDataSchema } from "./OutputLocalPathNodeDataSchema.js";

export const PipelineNodeDataSchema = z.union([
  CompoundNodeDataSchema,
  ConditionNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
]);
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema>;
