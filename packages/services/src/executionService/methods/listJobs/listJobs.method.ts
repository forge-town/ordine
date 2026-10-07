import type { ExecutionPrincipal } from "@repo/schemas";

import { jobDto } from "../../helpers/jobDto";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createListJobsMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const jobs = await serviceBindings.deps.jobs.listJobs(identity);

      return jobs.map(jobDto);
    });
