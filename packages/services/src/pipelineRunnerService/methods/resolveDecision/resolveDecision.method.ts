import { ok } from "neverthrow";

import { pipelineRunControl } from "../../helpers/runControl";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createResolveDecisionMethod =
  (_serviceBindings: Pick<PipelineRunnerServiceBindings, never>) =>
  (jobId: string, nodeId: string, selectedCandidateIds: string[]) =>
    ok(pipelineRunControl.resolveDecision(jobId, nodeId, selectedCandidateIds));
