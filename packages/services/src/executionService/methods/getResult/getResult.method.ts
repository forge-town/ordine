import { ExecutionJobResultSchema, type ExecutionPrincipal } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetResultMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "requireJob" | "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const job = await (0, serviceBindings.requireJob)(identity, id);
      const result = await serviceBindings.deps.repository.getPipelineRun(identity, job.id);
      const artifacts = await serviceBindings.deps.jobs.listArtifacts(identity, job.id);

      return ExecutionJobResultSchema.parse({
        jobId: job.id,
        state: job.state,
        outputs: result?.outputs ?? null,
        warnings: job.warnings,
        artifacts: artifacts.map((row) => row.metadata),
      });
    });
