import type { AgentResourceRef, AgentResourceType } from "@repo/schemas";

import { labelFor } from "../resourceControlLabelFor";

export const resourceRef = (
  type: AgentResourceType,
  value: Record<string, unknown>,
): AgentResourceRef => ({
  type,
  id: String(value.id),
  ...(labelFor(value) ? { label: labelFor(value) } : {}),
});
