import type {
  PipelineAgentAttachmentParseStatus,
  PipelineAgentAttachmentSourceType,
} from "@repo/schemas";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createRegisterAttachmentMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "attachmentsDao">) =>
  async (
    sessionId: string,
    input: {
      filename: string;
      mimeType: string;
      sizeBytes: number;
      sourceType?: PipelineAgentAttachmentSourceType;
      storageKey: string;
      parseStatus?: PipelineAgentAttachmentParseStatus;
      parseError?: string | null;
    },
  ) => {
    return serviceBindings.attachmentsDao.create({
      id: crypto.randomUUID(),
      sessionId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sourceType: input.sourceType ?? "upload",
      storageKey: input.storageKey,
      parseStatus: input.parseStatus ?? "pending",
      parseError: input.parseError ?? null,
    });
  };
