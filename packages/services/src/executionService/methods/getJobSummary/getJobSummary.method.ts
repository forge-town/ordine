import {
  ExecutionIdentifierSchema,
  ExecutionJobSummarySchema,
  type ExecutionPrincipal,
} from "@repo/schemas";

import { jobDto } from "../../helpers/jobDto";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetJobSummaryMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const { job, ...summary } = await serviceBindings.deps.jobs.getJobSummary(
        identity,
        ExecutionIdentifierSchema.parse(id),
      );

      return ExecutionJobSummarySchema.parse({ ...jobDto(job), ...summary });
    });
