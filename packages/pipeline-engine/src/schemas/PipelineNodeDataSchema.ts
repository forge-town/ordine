import { z } from "zod/v4";
import { CompoundNodeDataSchema } from "./CompoundNodeDataSchema";
import { CodeFileNodeDataSchema } from "./CodeFileNodeDataSchema";
import { FolderNodeDataSchema } from "./FolderNodeDataSchema";
import { GitHubProjectNodeDataSchema } from "./GitHubProjectNodeDataSchema";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema";
import { OutputProjectPathNodeDataSchema } from "./OutputProjectPathNodeDataSchema";
import { OutputLocalPathNodeDataSchema } from "./OutputLocalPathNodeDataSchema";

export const PipelineNodeDataSchema = z.discriminatedUnion("nodeType", [
  CompoundNodeDataSchema,
  CodeFileNodeDataSchema,
  FolderNodeDataSchema,
  GitHubProjectNodeDataSchema,
  OperationNodeDataSchema,
  OutputProjectPathNodeDataSchema,
  OutputLocalPathNodeDataSchema,
]);
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema>;
