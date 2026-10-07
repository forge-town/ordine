import type { PipelineAgentActivity, PipelineAgentSessionsServiceBindings } from "../../contracts";

import { createCancellationError } from "../createCancellationError";

export const createAssertActivityActiveHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "activeActivities">) =>
  (sessionId: string, activity: PipelineAgentActivity) => {
    if (
      activity.controller.signal.aborted ||
      serviceBindings.activeActivities.get(sessionId)?.controller !== activity.controller
    ) {
      throw createCancellationError(sessionId);
    }
  };
