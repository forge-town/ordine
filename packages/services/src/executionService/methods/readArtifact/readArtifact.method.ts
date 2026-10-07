import type { ExecutionPrincipal } from "@repo/schemas";

import { toExecutionServiceError } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createReadArtifactMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "deps">) =>
  (principal: ExecutionPrincipal, id: string, range: { offset?: number; length?: number } = {}) =>
    serviceBindings.deps.artifactStore
      .readArtifact(principal, id, range)
      .mapErr(toExecutionServiceError);
