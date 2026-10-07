import "../../../text-imports.d.ts";

import type { PerStepCapabilityAssignment } from "../../contracts";

export const buildAssignedOperationConfig = (assignment: PerStepCapabilityAssignment) => ({
  executor: assignment.executor,
  inputs: [],
  outputs: [
    {
      name: "result",
      contentType: "markdown" as const,
      description: "Generated result",
      templateIds: [],
    },
  ],
});
