import type { PipelineNode } from "../../schemas";

export const makeNode = (
  id: string,
  type: PipelineNode["type"],
  data: Record<string, unknown> = {},
): PipelineNode => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label: id, nodeType: type, ...data } as PipelineNode["data"],
});
