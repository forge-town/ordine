import { and, eq } from "drizzle-orm";
import { pipelineAgentAttachmentsTable, pipelineAgentContextArtifactsTable } from "@repo/db-schema";
import type { DbConnection } from "../../types";

export class PipelineAgentAttachmentsRepository {
  constructor(readonly db: DbConnection) {}

  async deleteWithContextArtifacts(sessionId: string, attachmentId: string) {
    return this.db.transaction(async (tx) => {
      const [attachment] = await tx
        .select()
        .from(pipelineAgentAttachmentsTable)
        .where(
          and(
            eq(pipelineAgentAttachmentsTable.id, attachmentId),
            eq(pipelineAgentAttachmentsTable.sessionId, sessionId),
          ),
        )
        .limit(1);

      if (!attachment) {
        return null;
      }

      await tx
        .delete(pipelineAgentContextArtifactsTable)
        .where(eq(pipelineAgentContextArtifactsTable.attachmentId, attachmentId));
      await tx
        .delete(pipelineAgentAttachmentsTable)
        .where(eq(pipelineAgentAttachmentsTable.id, attachmentId));

      return attachment;
    });
  }
}

export const createPipelineAgentAttachmentsRepository = (db: DbConnection) =>
  new PipelineAgentAttachmentsRepository(db);
