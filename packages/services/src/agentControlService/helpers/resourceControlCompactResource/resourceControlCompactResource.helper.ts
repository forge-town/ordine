import type { AgentResourceType } from "@repo/schemas";

import { serializeDates } from "../resourceControlSerializeDates";
import { truncateValue } from "../resourceControlTruncateValue";

export const compactResource = (type: AgentResourceType, raw: unknown): Record<string, unknown> => {
  const value = (serializeDates(raw) ?? {}) as Record<string, unknown>;
  if (type === "pipeline") {
    const { nodes, edges, ...metadata } = value;

    return {
      ...metadata,
      nodeCount: Array.isArray(nodes) ? nodes.length : 0,
      edgeCount: Array.isArray(edges) ? edges.length : 0,
    };
  }
  if (type === "pipeline-asset") {
    const { snapshotNodes, snapshotEdges, inputSlots, ...metadata } = value;

    return {
      ...metadata,
      nodeCount: Array.isArray(snapshotNodes) ? snapshotNodes.length : 0,
      edgeCount: Array.isArray(snapshotEdges) ? snapshotEdges.length : 0,
      inputSlotCount: Array.isArray(inputSlots) ? inputSlots.length : 0,
    };
  }
  if (type === "connector") {
    const { config: _config, encryptedCredentials: _credentials, ...metadata } = value;

    return metadata;
  }
  if (type === "distillation") {
    const { inputSnapshot: _inputSnapshot, result: _result, ...metadata } = value;

    return metadata;
  }

  return truncateValue(value) as Record<string, unknown>;
};
