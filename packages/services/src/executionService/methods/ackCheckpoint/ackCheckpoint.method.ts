import { ExecutionIdentifierSchema, type ExecutionPrincipal } from "@repo/schemas";

import { jobDto } from "../../helpers/jobDto";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createAckCheckpointMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, jobId: string, nodeId: string) =>
    (0, serviceBindings.scoped)(principal, "execution:control", async (identity) =>
      jobDto(
        await serviceBindings.deps.jobs.acknowledgeCheckpoint(
          identity,
          ExecutionIdentifierSchema.parse(jobId),
          ExecutionIdentifierSchema.parse(nodeId),
        ),
      ),
    );
