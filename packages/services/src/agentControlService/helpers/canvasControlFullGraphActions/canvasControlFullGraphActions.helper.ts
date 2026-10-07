import type { PipelineAction, PipelineGraphSnapshot } from "@repo/schemas";

export const fullGraphActions = (snapshot: PipelineGraphSnapshot): PipelineAction[] => [
  ...snapshot.nodes.map((node) => ({ type: "addNode" as const, node })),
  ...snapshot.edges.map((edge) => ({ type: "addEdge" as const, edge })),
];
