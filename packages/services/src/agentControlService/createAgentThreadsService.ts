import { randomUUID } from "node:crypto";
import {
  createAgentThreadsDao,
  createPipelineAgentMessagesDao,
  type DbConnection,
} from "@repo/models";
import {
  AgentContextEnvelopeSchema,
  AgentThreadSchema,
  PipelineAgentMessageSchema,
  type AgentContextEnvelope,
  type AgentThread,
  type PipelineAgentMessage,
} from "@repo/schemas";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { NotFoundError, toServiceError } from "../serviceErrors";

const toThread = (
  row: NonNullable<Awaited<ReturnType<ReturnType<typeof createAgentThreadsDao>["findById"]>>>,
): AgentThread =>
  AgentThreadSchema.parse({
    id: row.id,
    title: row.title,
    actor: row.actor,
    status: row.threadStatus,
    activeContext: row.activeContext ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });

const toMessage = (
  row: Awaited<
    ReturnType<ReturnType<typeof createPipelineAgentMessagesDao>["findManyBySessionId"]>
  >[number],
): PipelineAgentMessage => PipelineAgentMessageSchema.parse(row);

export const createAgentThreadsService = (db: DbConnection) => {
  const threadsDao = createAgentThreadsDao(db);
  const messagesDao = createPipelineAgentMessagesDao(db);

  return {
    getAll: () =>
      ResultAsync.fromPromise(threadsDao.findMany(), (error) =>
        toServiceError(error, "Get Agent threads"),
      ).map((threads) => threads.map(toThread)),

    getById: (id: string) =>
      ResultAsync.fromPromise(threadsDao.findById(id), (error) =>
        toServiceError(error, "Get Agent thread"),
      ).andThen((thread) =>
        thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
      ),

    create: ({
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
        threadsDao.create({ id, title, activeContext: parsedContext }),
        (error) => toServiceError(error, "Create Agent thread"),
      ).map(toThread);
    },

    updateContext: (id: string, context: AgentContextEnvelope) => {
      const parsed = AgentContextEnvelopeSchema.parse(context);

      return ResultAsync.fromPromise(
        threadsDao.update(id, {
          activeContext: parsed,
          pipelineId: parsed.pipelineId,
        }),
        (error) => toServiceError(error, "Update Agent thread context"),
      ).andThen((thread) =>
        thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
      );
    },

    rename: (id: string, title: string) =>
      ResultAsync.fromPromise(threadsDao.update(id, { title }), (error) =>
        toServiceError(error, "Rename Agent thread"),
      ).andThen((thread) =>
        thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
      ),

    archive: (id: string) =>
      ResultAsync.fromPromise(threadsDao.update(id, { threadStatus: "archived" }), (error) =>
        toServiceError(error, "Archive Agent thread"),
      ).andThen((thread) =>
        thread ? okAsync(toThread(thread)) : errAsync(new NotFoundError("AgentThread", id)),
      ),

    getMessages: (threadId: string) =>
      ResultAsync.fromPromise(messagesDao.findManyBySessionId(threadId), (error) =>
        toServiceError(error, "Get Agent thread messages"),
      ).map((messages) => messages.map(toMessage)),

    addMessage: ({
      threadId,
      role,
      content,
      context = null,
      runId = null,
      kind = "text",
    }: {
      threadId: string;
      role: "user" | "assistant" | "system";
      content: string;
      context?: AgentContextEnvelope | null;
      runId?: string | null;
      kind?:
        | "text"
        | "question"
        | "answer"
        | "proposal_summary"
        | "generation_result"
        | "phase"
        | "progress";
    }) =>
      ResultAsync.fromPromise(
        messagesDao.create({
          id: randomUUID(),
          sessionId: threadId,
          role,
          kind,
          content,
          context,
          runId,
        }),
        (error) => toServiceError(error, "Add Agent thread message"),
      ).map(toMessage),
  };
};
