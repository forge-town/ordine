import type { RunControlState, RunControlAssemblyBindings } from "../../contracts";

import { createRunControlGetStateHelper } from "../runControlGetState";
import { createRunControlReleaseWaitersHelper } from "../runControlReleaseWaiters";
import { createRunControlRejectDecisionWaitersHelper } from "../runControlRejectDecisionWaiters";

import { createRunControlSignalMethod } from "../../methods/runControlSignal";
import { createRunControlBuildForJobMethod } from "../../methods/runControlBuildForJob";
import { createRunControlClearMethod } from "../../methods/runControlClear";
import { createRunControlPauseMethod } from "../../methods/runControlPause";
import { createRunControlResumeMethod } from "../../methods/runControlResume";
import { createRunControlCancelMethod } from "../../methods/runControlCancel";
import { createRunControlResolveDecisionMethod } from "../../methods/runControlResolveDecision";

const createRunControlAssembly = () => {
  const serviceBindings: RunControlAssemblyBindings = {
    get states() {
      return states;
    },
    get getState() {
      return getState;
    },
    get releaseWaiters() {
      return releaseWaiters;
    },
    get rejectDecisionWaiters() {
      return rejectDecisionWaiters;
    },
  };

  const states = new Map<string, RunControlState>();

  const getState = createRunControlGetStateHelper(serviceBindings);

  const releaseWaiters = createRunControlReleaseWaitersHelper(serviceBindings);

  const rejectDecisionWaiters = createRunControlRejectDecisionWaitersHelper(serviceBindings);

  return {
    signal: createRunControlSignalMethod(serviceBindings),

    buildForJob: createRunControlBuildForJobMethod(serviceBindings),

    /** Final cleanup once the run has settled; releases anything still parked, defensively. */
    clear: createRunControlClearMethod(serviceBindings),

    pause: createRunControlPauseMethod(serviceBindings),

    resume: createRunControlResumeMethod(serviceBindings),

    /**
     * Interrupt the active Agent process, set the cancel flag, wake every parked
     * resume waiter, and reject every pending decision waiter. Keeps the state
     * alive until clear() runs on settle, so boundary checks keep seeing cancel.
     */
    cancel: createRunControlCancelMethod(serviceBindings),

    /**
     * Apply the user's decision: wake the suspended decision node (the engine
     * never picks a default). `selectedCandidateIds` are the candidateId values
     * from PipelineDecisionEvent.candidates (the incoming edge ids), not node ids.
     */
    resolveDecision: createRunControlResolveDecisionMethod(serviceBindings),
  };
};

export const pipelineRunControl = createRunControlAssembly();
