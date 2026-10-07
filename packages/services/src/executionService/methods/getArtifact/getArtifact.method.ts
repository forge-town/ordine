import type { ExecutionPrincipal } from "@repo/schemas";

import { toExecutionServiceError } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetArtifactMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    serviceBindings.deps.artifactStore
      .readArtifact(principal, id, { length: 0 })
      .map(({ metadata }) => metadata)
      .mapErr(toExecutionServiceError);
