import { mkdir, writeFile } from "node:fs/promises";

import { ResultAsync } from "neverthrow";

import { toSafeStoragePath } from "../../helpers/toSafeStoragePath";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createIngestAttachmentMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "PIPELINE_AGENT_MAX_ATTACHMENT_BYTES"
      | "getAttachmentKindAndContent"
      | "attachmentsDao"
      | "contextArtifactsDao"
    >,
  ) =>
  async (
    sessionId: string,
    input: {
      bytes: Uint8Array;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      runtimeId?: string;
    },
  ) => {
    const attachmentId = crypto.randomUUID();
    if (
      input.sizeBytes > serviceBindings.PIPELINE_AGENT_MAX_ATTACHMENT_BYTES ||
      input.bytes.byteLength > serviceBindings.PIPELINE_AGENT_MAX_ATTACHMENT_BYTES
    ) {
      throw new Error(
        `Attachment exceeds the ${serviceBindings.PIPELINE_AGENT_MAX_ATTACHMENT_BYTES} byte size limit`,
      );
    }

    const { storageDir, storageKey } = toSafeStoragePath(sessionId, attachmentId, input.filename);
    await mkdir(storageDir, { recursive: true });
    await writeFile(storageKey, input.bytes);

    const artifactShapeResult = await ResultAsync.fromPromise(
      (0, serviceBindings.getAttachmentKindAndContent)(input),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (artifactShapeResult.isErr()) {
      const attachment = await serviceBindings.attachmentsDao.create({
        id: attachmentId,
        sessionId,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        sourceType: "upload",
        storageKey,
        parseStatus: "failed",
        parseError: artifactShapeResult.error.message,
      });

      return { attachment, artifacts: [] };
    }

    const attachment = await serviceBindings.attachmentsDao.create({
      id: attachmentId,
      sessionId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sourceType: "upload",
      storageKey,
      parseStatus: "parsed",
      parseError: null,
    });

    const artifactShape = artifactShapeResult.value;
    const artifact = await serviceBindings.contextArtifactsDao.create({
      id: crypto.randomUUID(),
      sessionId,
      attachmentId,
      kind: artifactShape.kind,
      content: artifactShape.content,
    });

    return { attachment, artifacts: [artifact] };
  };
