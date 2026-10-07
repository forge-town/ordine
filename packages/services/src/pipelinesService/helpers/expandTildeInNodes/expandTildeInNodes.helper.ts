import "../../../text-imports.d.ts";

import type { PipelineData } from "@repo/schemas";

import { normalizeGeneratedPath } from "../normalizeGeneratedPath";

export const expandTildeInNodes = (nodes: PipelineData["nodes"]): PipelineData["nodes"] =>
  nodes.map((node) => {
    const { data } = node;
    if (data.nodeType === "folder" && data.folderPath) {
      return { ...node, data: { ...data, folderPath: normalizeGeneratedPath(data.folderPath) } };
    }
    if (data.nodeType === "output-local-path" && data.localPath) {
      return { ...node, data: { ...data, localPath: normalizeGeneratedPath(data.localPath) } };
    }

    return node;
  });
