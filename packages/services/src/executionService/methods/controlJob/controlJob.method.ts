import {
  ExecutionIdentifierSchema,
  ExecutionJobControlSchema,
  type ExecutionPrincipal,
} from "@repo/schemas";

import { jobDto } from "../../helpers/jobDto";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createControlJobMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string, input: unknown) =>
    (0, serviceBindings.scoped)(principal, "execution:control", async (identity) =>
      jobDto(
        await serviceBindings.deps.jobs.requestControl(
          identity,
          ExecutionIdentifierSchema.parse(id),
          ExecutionJobControlSchema.parse(input).action,
        ),
      ),
    );
