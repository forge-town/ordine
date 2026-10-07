import { ExecutionJobSummarySchema, type ExecutionPrincipal } from "@repo/schemas";

import { jobDto } from "../../helpers/jobDto";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createListJobSummariesMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const summaries = await serviceBindings.deps.jobs.listJobSummaries(identity);

      return summaries.map(({ job, ...summary }) =>
        ExecutionJobSummarySchema.parse({ ...jobDto(job), ...summary }),
      );
    });
