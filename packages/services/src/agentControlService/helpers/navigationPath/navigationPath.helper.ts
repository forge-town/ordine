import type { AgentResourceRef } from "@repo/schemas";

export const navigationPath = (resource: AgentResourceRef): string => {
  if (resource.type === "operation")
    return `/pipelines/operations/${encodeURIComponent(resource.id)}`;
  if (resource.type === "routine") return "/schedule";
  if (resource.type === "job") return "/pipelines/jobs";
  if (resource.type === "connector") return "/connectors";
  if (resource.type === "skill") return "/skills";
  const plural = resource.type === "pipeline-asset" ? "pipeline-assets" : `${resource.type}s`;

  return `/${plural}/${encodeURIComponent(resource.id)}`;
};
