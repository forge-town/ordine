import {
  buildCapabilityAssignmentPrompt,
  buildCapabilityAssignmentRepairPrompt,
} from "./buildCapabilityAssignmentPrompt";
import { parseCapabilityAssignments } from "./parseCapabilityAssignments";
import type { CapabilityAssignmentContext, PerStepCapabilityAssignment } from "./schemas";

export type CapabilityAssignmentAgentResult =
  | { ok: true; json: unknown }
  | { ok: false; error: string };

export type CapabilityAssignmentPlanResult =
  | { ok: true; assignments: PerStepCapabilityAssignment[]; attempts: 1 | 2 }
  | { ok: false; assignments: []; attempts: 1 | 2; diagnostics: string[] };

export const planCapabilityAssignments = async (input: {
  context: CapabilityAssignmentContext;
  runAgent: (userPrompt: string) => Promise<CapabilityAssignmentAgentResult>;
}): Promise<CapabilityAssignmentPlanResult> => {
  const firstAgentResult = await input.runAgent(buildCapabilityAssignmentPrompt(input.context));
  if (!firstAgentResult.ok) {
    return {
      ok: false,
      assignments: [],
      attempts: 1,
      diagnostics: [firstAgentResult.error],
    };
  }

  const firstParse = parseCapabilityAssignments(firstAgentResult.json, input.context);
  if (firstParse.ok) {
    return { ok: true, assignments: firstParse.assignments, attempts: 1 };
  }

  const repairedAgentResult = await input.runAgent(
    buildCapabilityAssignmentRepairPrompt(
      input.context,
      firstAgentResult.json,
      firstParse.diagnostics,
    ),
  );
  if (!repairedAgentResult.ok) {
    return {
      ok: false,
      assignments: [],
      attempts: 2,
      diagnostics: [...firstParse.diagnostics, repairedAgentResult.error],
    };
  }

  const repairedParse = parseCapabilityAssignments(repairedAgentResult.json, input.context);

  return repairedParse.ok
    ? { ok: true, assignments: repairedParse.assignments, attempts: 2 }
    : {
        ok: false,
        assignments: [],
        attempts: 2,
        diagnostics: repairedParse.diagnostics,
      };
};
