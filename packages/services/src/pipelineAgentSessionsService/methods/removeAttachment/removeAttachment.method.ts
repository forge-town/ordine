import { unlink } from "node:fs/promises";

import { ResultAsync } from "neverthrow";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createRemoveAttachmentMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      "sessionsDao" | "attachmentsRepository"
    >,
  ) =>
  async (sessionId: string, attachmentId: string) => {
    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (!session) {
      throw new Error(`Pipeline agent session not found: ${sessionId}`);
    }
    if (session.status !== "draft" && session.status !== "awaiting_user") {
      throw new Error(
        `Pipeline agent attachment cannot be removed while session ${sessionId} is ${session.status}`,
      );
    }

    const attachment = await serviceBindings.attachmentsRepository.deleteWithContextArtifacts(
      sessionId,
      attachmentId,
    );
    if (!attachment) {
      throw new Error(`Pipeline agent attachment not found: ${attachmentId}`);
    }

    const unlinkResult = await ResultAsync.fromPromise(unlink(attachment.storageKey), (error) =>
      error instanceof Error ? error : new Error(String(error)),
    );
    if (unlinkResult.isErr() && (unlinkResult.error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw unlinkResult.error;
    }

    return attachment;
  };
