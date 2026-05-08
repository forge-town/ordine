import { z } from "zod/v4";
import {
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
} from "@repo/pipeline-engine/schemas";
import { PromptNodeDataSchema } from "@repo/schemas";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema";

export const PipelineNodeDataSchema = z.discriminatedUnion("nodeType", [
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
  CompoundNodeDataSchema,
  PromptNodeDataSchema,
]);
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema>;
