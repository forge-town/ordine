import { z } from "zod/v4";
import { PipelineNodeDataSchema } from "./node-data/PipelineNodeDataSchema";
import { PipelineGraphNodeSchema, PipelineGraphEdgeSchema } from "./PipelineGraphSnapshotSchema";

export const AddNodePipelineActionSchema = z.object({
  type: z.literal("addNode"),
  node: PipelineGraphNodeSchema,
});

export const RemoveNodePipelineActionSchema = z.object({
  type: z.literal("removeNode"),
  nodeId: z.string(),
});

export const AddEdgePipelineActionSchema = z.object({
  type: z.literal("addEdge"),
  edge: PipelineGraphEdgeSchema,
});

export const RemoveEdgePipelineActionSchema = z.object({
  type: z.literal("removeEdge"),
  edgeId: z.string(),
});

export const ReconnectEdgePipelineActionSchema = z.object({
  type: z.literal("reconnectEdge"),
  edgeId: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
});

export const ReplaceNodeDataPipelineActionSchema = z.object({
  type: z.literal("replaceNodeData"),
  nodeId: z.string(),
  data: PipelineNodeDataSchema,
});

export const PipelineActionSchema = z.discriminatedUnion("type", [
  AddNodePipelineActionSchema,
  RemoveNodePipelineActionSchema,
  AddEdgePipelineActionSchema,
  RemoveEdgePipelineActionSchema,
  ReconnectEdgePipelineActionSchema,
  ReplaceNodeDataPipelineActionSchema,
]);
export type PipelineAction = z.infer<typeof PipelineActionSchema>;
