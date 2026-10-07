import type { ExecutionPrincipal } from "@repo/schemas";

import { jobDto } from "../../helpers/jobDto";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetJobMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "requireJob">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) =>
      jobDto(await (0, serviceBindings.requireJob)(identity, id)),
    );
