import type { AgentControlToolName } from "@repo/agent-control";

import type { AgentResourceRef } from "@repo/schemas";

export const targetFrom = (name: AgentControlToolName, input: unknown): AgentResourceRef | null => {
  const value = input as Record<string, unknown>;
  if (
    name === "ordine.get_resource" ||
    name === "ordine.update_resource" ||
    name === "ordine.archive_resource" ||
    name === "ordine.delete_resource"
  ) {
    return {
      type: value.resourceType as AgentResourceRef["type"],
      id: String(value.id),
    };
  }
  if (name === "ordine.create_resource") {
    const data = value.data as Record<string, unknown>;

    return typeof data.id === "string"
      ? { type: value.resourceType as AgentResourceRef["type"], id: data.id }
      : null;
  }
  if (name.includes("canvas") || name.includes("node") || name.includes("edge")) {
    return typeof value.pipelineId === "string" ? { type: "pipeline", id: value.pipelineId } : null;
  }
  if (name === "ordine.prepare_pipeline_run")
    return { type: "pipeline", id: String(value.pipelineId) };
  if (name === "ordine.prepare_operation_run")
    return { type: "operation", id: String(value.operationId) };
  if (name === "ordine.prepare_routine_run")
    return { type: "routine", id: String(value.routineId) };
  if (name === "ordine.control_job" || name === "ordine.get_job_trace") {
    return { type: "job", id: String(value.jobId) };
  }
  if (name === "ordine.test_connector") return { type: "connector", id: String(value.connectorId) };

  return null;
};
