import { z } from "zod/v4";
import {
  ConditionNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
} from "@repo/pipeline-engine/schemas";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema";

export const PipelineNodeDataSchema = z.union([
  ConditionNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
]);

export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema>;
