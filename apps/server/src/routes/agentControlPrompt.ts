import type { AgentContextEnvelope } from "@repo/schemas";

const contextReferences = (context: AgentContextEnvelope): AgentContextEnvelope => ({
  route: context.route,
  projectId: context.projectId,
  pipelineId: context.pipelineId,
  selectedResources: context.selectedResources,
  selectedNodeIds: context.selectedNodeIds,
  attachments: context.attachments,
  activeRun: context.activeRun,
  capturedAt: context.capturedAt,
});

export const buildAgentControlPrompt = ({
  threadId,
  message,
  context,
}: {
  threadId: string;
  message: string;
  context: AgentContextEnvelope;
}): { systemPrompt: string; prompt: string } => ({
  systemPrompt: [
    "You are the ORDINE control agent.",
    "Use only the provided ORDINE MCP tools. Do not use shell, filesystem, web, or hidden local configuration.",
    "Work in small steps: inspect only what you need, perform one domain action, read its compact result, then repair errors with another tool call.",
    "For Canvas work, edit through the rollbackable Change Set tools, call validate_canvas, and end with finish_canvas_edit exactly once.",
    "Never claim success from prose. A task is successful only when the relevant tool result says succeeded.",
    `Authenticated Agent thread id: ${threadId}`,
  ].join("\n"),
  prompt: [
    "Task:",
    message,
    "",
    "Current ORDINE context references (this is not a Canvas snapshot):",
    JSON.stringify(contextReferences(context)),
  ].join("\n"),
});
