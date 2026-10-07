import type { CanvasMutationInput } from "../../contracts";

export const changeSetInput = (input: CanvasMutationInput) => ({
  pipelineId: input.pipelineId,
  threadId: input.threadId,
  runId: input.runId ?? null,
  changeSetId: input.changeSetId,
  callId: input.callId,
});
