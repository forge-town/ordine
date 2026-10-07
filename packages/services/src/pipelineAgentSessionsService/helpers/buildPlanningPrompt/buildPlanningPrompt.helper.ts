import type { PipelineAgentMode, PipelineGraphSnapshot } from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createBuildPlanningPromptHelper =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      "contextArtifactsDao" | "messagesDao" | "operationsDao"
    >,
  ) =>
  (input: {
    artifacts: Awaited<ReturnType<typeof serviceBindings.contextArtifactsDao.findManyBySessionId>>;
    messages: Awaited<ReturnType<typeof serviceBindings.messagesDao.findManyBySessionId>>;
    mode: PipelineAgentMode;
    operations: Awaited<ReturnType<typeof serviceBindings.operationsDao.findMany>>;
    pipelineId: string | null;
    snapshot: PipelineGraphSnapshot | null;
  }) => {
    const artifactSummary =
      input.artifacts.length === 0
        ? "(none)"
        : input.artifacts
            .map((artifact) => JSON.stringify({ kind: artifact.kind, content: artifact.content }))
            .join("\n");
    const conversationSummary =
      input.messages.length === 0
        ? "(none)"
        : input.messages
            .map((message) => `[${message.role}/${message.kind}] ${message.content}`)
            .join("\n");

    return [
      "You are a pipeline planning assistant for Ordine.",
      `Planning mode: ${input.mode}`,
      input.mode === "edit"
        ? "Return either a follow-up question or an edit proposal for the current graph."
        : "Return either a follow-up question or a generation proposal for a new pipeline.",
      "",
      "=== OUTPUT FORMAT ===",
      input.mode === "edit"
        ? '{"type":"question","question":"..."} OR {"type":"proposal","proposal":{"mode":"edit","assistantReply":"...","summary":"...","targetGraphIntent":"...","majorChanges":["..."],"assumptions":[],"openQuestions":[],"actions":[],"diagnosticsPreview":[],"readiness":"needs_user_answer|ready_for_generation"}}'
        : '{"type":"question","question":"..."} OR {"type":"proposal","proposal":{"mode":"generate","assistantReply":"...","purpose":"...","inputs":["..."],"outputs":["..."],"majorOperations":["..."],"executionFlow":["..."],"assumptions":[],"openQuestions":[],"schedule":null|{"name":"...","cronExpression":"0 9 * * 1-5","enabled":true},"readiness":"needs_user_answer|ready_for_generation"}}',
      "For every proposal, assistantReply is the user-facing chat response in the user's language. Make it substantive and scannable: usually 2-4 short paragraphs explaining what you understood, the proposed structure and dependency choices, important assumptions or open points, and what the user can do next. Do not reduce it to a single sentence, and do not duplicate the full proposal field list.",
      input.mode === "generate"
        ? "Only include schedule when the user explicitly requests recurring execution. A schedule is Pipeline metadata, never a majorOperation. Use a valid 5-field cron expression in the server's local timezone; ask a follow-up question when the requested time is ambiguous."
        : "",
      input.mode === "generate"
        ? "AVAILABLE OPERATIONS ARE REUSABLE EXAMPLES, NOT A CAPABILITY LIMIT. The generation phase can create missing Operations automatically. When the user's goal, inputs, and outputs are sufficiently clear, propose every required majorOperation (including new ones) and set readiness to ready_for_generation. Do not ask the user to choose a placeholder Pipeline or manually extend Operations first."
        : "",
      "",
      `Pipeline ID: ${input.pipelineId ?? "(new pipeline)"}`,
      input.snapshot
        ? `Current snapshot: ${JSON.stringify(input.snapshot)}`
        : "Current snapshot: (none)",
      "",
      "=== ATTACHMENT CONTEXT ===",
      artifactSummary,
      "",
      "=== CONVERSATION ===",
      conversationSummary,
      "",
      "=== AVAILABLE OPERATIONS ===",
      JSON.stringify(
        input.operations.map((operation) => ({
          id: operation.id,
          name: operation.name,
          description: operation.description,
          acceptedObjectTypes: operation.acceptedObjectTypes,
        })),
      ),
      "",
      "Return JSON only.",
    ].join("\n");
  };
