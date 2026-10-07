import type { PipelineAgentProposal } from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createBuildGenerationDescriptionHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) =>
  (proposal: Extract<PipelineAgentProposal, { mode: "generate" }>) =>
    [
      `Purpose: ${proposal.purpose}`,
      `Inputs: ${proposal.inputs.join(", ") || "(none)"}`,
      `Outputs: ${proposal.outputs.join(", ") || "(none)"}`,
      `Major operations: ${proposal.majorOperations.join(", ") || "(none)"}`,
      `Execution flow: ${proposal.executionFlow.join(" -> ") || "(none)"}`,
      proposal.assumptions.length > 0
        ? `Assumptions: ${proposal.assumptions.join("; ")}`
        : "Assumptions: (none)",
      proposal.openQuestions.length > 0
        ? `Open questions: ${proposal.openQuestions.join("; ")}`
        : "Open questions: (none)",
      proposal.schedule
        ? `Schedule metadata (do not create an Operation): ${proposal.schedule.cronExpression}`
        : "Schedule metadata: (none)",
    ].join("\n");
