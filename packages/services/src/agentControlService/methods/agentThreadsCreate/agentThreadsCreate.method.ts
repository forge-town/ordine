import { randomUUID } from "node:crypto";

import { AgentContextEnvelopeSchema, type AgentContextEnvelope } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { toServiceError } from "../../../serviceErrors";
import { toThread } from "../../helpers/agentThreadsToThread";

import type { AgentThreadsServiceBindings } from "../../contracts";
export const createAgentThreadsCreateMethod =
  (serviceBindings: Pick<AgentThreadsServiceBindings, "threadsDao">) =>
  ({
    title = "New agent thread",
    context = null,
    id = randomUUID(),
  }: {
    title?: string;
    context?: AgentContextEnvelope | null;
    id?: string;
  } = {}) => {
    const parsedContext = context ? AgentContextEnvelopeSchema.parse(context) : null;

    return ResultAsync.fromPromise(
      serviceBindings.threadsDao.create({ id, title, activeContext: parsedContext }),
      (error) => toServiceError(error, "Create Agent thread"),
    ).map(toThread);
  };
