import type { PipelineEdge } from "@repo/schemas";

export const makeEdge = (source: string, target: string): PipelineEdge => ({
  id: `${source}-${target}`,
  source,
  target,
});
