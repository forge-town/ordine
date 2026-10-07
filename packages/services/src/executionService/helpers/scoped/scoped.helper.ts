import type { ExecutionPrincipal, ExecutionScope } from "@repo/schemas";

import { executionServiceResult, requireExecutionScope } from "../serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createScopedHelper =
  (_serviceBindings: Pick<ExecutionApiServiceBindings, never>) =>
  <T>(
    principal: ExecutionPrincipal,
    scope: ExecutionScope,
    action: (identity: ExecutionPrincipal) => Promise<T>,
  ) =>
    executionServiceResult(async () => action(requireExecutionScope(principal, scope)));
