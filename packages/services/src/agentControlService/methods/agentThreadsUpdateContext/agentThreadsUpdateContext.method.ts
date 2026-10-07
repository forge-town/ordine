import { AgentContextEnvelopeSchema, type AgentContextEnvelope } from "@repo/schemas";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NotFoundError, toServiceError } from "../../../serviceErrors";
import { toThread } from "../../helpers/agentThreadsToThread";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsUpdateContextMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "threadsDao">) =>
  (id: string, context: AgentContextEnvelope) => {
    const parsed = AgentContextEnvelopeSchema.parse(context);

    return ResultAsync.fromPromise(
      serviceBindings.threadsDao.update(id, {
        activeContext: parsed,
        pipelineId: parsed.pipelineId,
      }),
      (error) => toServiceError(error, "Update Agent thread context"),
    ).andThen((thread) =>
      thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
    );
  };
