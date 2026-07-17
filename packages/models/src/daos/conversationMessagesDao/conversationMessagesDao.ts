import { asc, desc, eq } from "drizzle-orm";
import { conversationMessagesTable } from "@repo/db-schema";
import type { DbExecutor } from "../../types";

export class ConversationMessagesDao {
  constructor(readonly executor: DbExecutor) {}

  async findMany() {
    return this.executor
      .select()
      .from(conversationMessagesTable)
      .orderBy(desc(conversationMessagesTable.createdAt));
  }

  async findById(id: string) {
    const rows = await this.executor
      .select()
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.id, id))
      .limit(1);

    return rows[0];
  }

  async findManyByPipelineId(pipelineId: string, limit?: number) {
    const query = this.executor
      .select()
      .from(conversationMessagesTable)
      .where(eq(conversationMessagesTable.pipelineId, pipelineId))
      .orderBy(asc(conversationMessagesTable.createdAt));

    return limit === undefined ? query : query.limit(limit);
  }

  async create(data: typeof conversationMessagesTable.$inferInsert) {
    const [inserted] = await this.executor
      .insert(conversationMessagesTable)
      .values(data)
      .returning();

    return inserted!;
  }

  async update(
    id: string,
    patch: Partial<Omit<typeof conversationMessagesTable.$inferInsert, "id">>,
  ) {
    const [updated] = await this.executor
      .update(conversationMessagesTable)
      .set(patch)
      .where(eq(conversationMessagesTable.id, id))
      .returning();

    return updated;
  }

  async delete(id: string) {
    await this.executor
      .delete(conversationMessagesTable)
      .where(eq(conversationMessagesTable.id, id));
  }
}

export const createConversationMessagesDao = (executor: DbExecutor) =>
  new ConversationMessagesDao(executor);
