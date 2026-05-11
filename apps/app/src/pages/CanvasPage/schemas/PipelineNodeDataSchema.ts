import { z } from "zod/v4";
import {
  FileObjectNodeDataSchema,
  FolderObjectNodeDataSchema,
  GithubProjectObjectNodeDataSchema,
  ProjectPathOutputNodeDataSchema,
  LocalPathOutputNodeDataSchema,
  CompoundNodeDataSchema,
  PromptObjectNodeDataSchema,
} from "@repo/schemas";
import { OperationNodeDataSchema } from "./OperationNodeDataSchema";

export const PipelineNodeDataSchema = z.discriminatedUnion("nodeType", [
  FileObjectNodeDataSchema,
  FolderObjectNodeDataSchema,
  GithubProjectObjectNodeDataSchema,
  OperationNodeDataSchema,
  ProjectPathOutputNodeDataSchema,
  LocalPathOutputNodeDataSchema,
  CompoundNodeDataSchema,
  PromptObjectNodeDataSchema,
]);
export type PipelineNodeData = z.infer<typeof PipelineNodeDataSchema>;
