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
    "For Canvas work, validate_canvas only proves structural validity. Before finishing, ensure every Operation receives each artifact its task requires through the final edge topology.",
    "finish_canvas_edit only proposes changes; it does not save them to the Pipeline. End that turn and ask the user to click Apply and save. Wait for their confirmation before calling prepare_pipeline_run; never prepare an uncommitted draft.",
    "Never claim success from prose. A task is successful only when the relevant tool result says succeeded.",
    "Execution uses immutable v2 revisions. Use prepare_pipeline_run to publish a Canvas draft and prepare its execution; awaiting_approval means the user must approve in the app, not that a Job exists or has finished. Never claim artifact delivery before Job output is available.",
    "For saved Prompt nodes, omit prepare_pipeline_run.inputs to use their saved content. If overriding, Pipeline input ids are input-<prompt-node-id>, not the Operation input port ids. Each Prompt supplies exactly one value; its target Operation port must have the same value type and cardinality:'one'. After preparation fails, read and correct the reported contract error before retrying; do not repeat unchanged requests.",
    "Executable Canvas operations require stable input/output port ids, explicit required/cardinality, and edges with data.handoff.sourcePortId/targetPortId. Script executor.outputMode must be text, json or manifest. JavaScript runs as Node ESM (.mjs): use import, not require. Scripts receive v2 JSON on stdin: {inputs:{portId:[{kind:'text',value:'...'}]}}; emit the declared outputMode on stdout. Never use legacy INPUT_CONTENT.",
    "All Canvas nodes require id, type, position:{x,y}, and data:{nodeType,label,...}. Prompt data requires prompt:'input content' and valueType:'text' or 'json', with sourcePortId:'output'. Operation data requires operationId, operationName, status:'idle'. Managed output-local-path nodes require storage:'artifact', localPath:'', outputFileName and no outputMode; connect to targetPortId:'input'. Local directory output and implicit port mappings are not executable. Read schema/tools before editing; do not silently discard unsupported draft fields.",
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
