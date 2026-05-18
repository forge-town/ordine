import { z } from "zod/v4";
import { CompoundNodeDataSchema } from "./CompoundNodeDataSchema";
import { FileObjectNodeDataSchema } from "./FileObjectNodeDataSchema";
import { FolderObjectNodeDataSchema } from "./FolderObjectNodeDataSchema";
import { GithubProjectObjectNodeDataSchema } from "./GithubProjectObjectNodeDataSchema";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema";
import { ProjectPathOutputNodeDataSchema } from "./ProjectPathOutputNodeDataSchema";
import { LocalPathOutputNodeDataSchema } from "./LocalPathOutputNodeDataSchema";
import { PromptObjectNodeDataSchema } from "./PromptObjectNodeDataSchema";

export const PipelineNodeDataSchema = z.discriminatedUnion("nodeType", [
  CompoundNodeDataSchema,
  FileObjectNodeDataSchema,
  FolderObjectNodeDataSchema,
  GithubProjectObjectNodeDataSchema,
  OperationNodeDataSchema,
  ProjectPathOutputNodeDataSchema,
  LocalPathOutputNodeDataSchema,
  PromptObjectNodeDataSchema,
]);
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema>;
