import { randomUUID } from "node:crypto";

import type { AgentControlInvocationContext } from "@repo/agent-control";

import { ResultAsync } from "neverthrow";

import type { InvocationState, AgentControlServiceBindings } from "../../contracts";

import { failureResult } from "../../helpers/failureResult";
import { unexpectedError } from "../../helpers/unexpectedError";

export const createInvokeMethod = (
  serviceBindings: Pick<
    AgentControlServiceBindings,
    "invokeInternal" | "actionsDao" | "persistFailure"
  >,
) =>
  ({
    invoke(name: string, input: unknown, context: AgentControlInvocationContext) {
      const invocation: InvocationState = {
        actionId: null,
        runId: context.runId,
        toolName: null,
        resources: [],
      };

      return ResultAsync.fromPromise(
        (0, serviceBindings.invokeInternal)(name, input, context, invocation),
        unexpectedError,
      ).match(
        (result) => result,
        async (error) => {
          if (invocation.actionId && invocation.toolName) {
            const action = await serviceBindings.actionsDao.findById(invocation.actionId);
            if (action?.status === "started") {
              return (0, serviceBindings.persistFailure)({
                actionId: invocation.actionId,
                toolName: invocation.toolName,
                runId: invocation.runId,
                error,
                resources: invocation.resources,
              });
            }
          }

          return failureResult({
            actionId: invocation.actionId ?? randomUUID(),
            error,
            resources: invocation.resources,
          });
        },
      );
    },
  }).invoke;
