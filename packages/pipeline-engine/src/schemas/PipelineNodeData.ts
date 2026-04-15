import { z } from "zod/v4";
import { CompoundNodeDataSchema } from "./CompoundNodeData.js";
import { ConditionNodeDataSchema } from "./ConditionNodeData.js";
import { CodeFileNodeDataSchema } from "./CodeFileNodeData.js";
import { FolderNodeDataSchema } from "./FolderNodeData.js";
import { GitHubProjectNodeDataSchema } from "./GitHubProjectNodeData.js";
import { OperationNodeDataSchema } from "./OperationNodeData.js";
import { OutputProjectPathNodeDataSchema } from "./OutputProjectPathNodeData.js";
import { OutputLocalPathNodeDataSchema } from "./OutputLocalPathNodeData.js";

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
