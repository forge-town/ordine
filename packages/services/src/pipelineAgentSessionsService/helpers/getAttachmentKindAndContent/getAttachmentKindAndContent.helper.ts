import { extname } from "node:path";

import type {
  PipelineAgentContextArtifactContent,
  PipelineAgentContextArtifactKind,
} from "@repo/schemas";

import { createRuntimeNotFoundError } from "../createRuntimeNotFoundError";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createGetAttachmentKindAndContentHelper =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "settingsDao"
      | "agentRuntimesDao"
      | "resolveAttachmentRuntime"
      | "createImageSummaryArtifact"
      | "decodeText"
      | "extractDocxText"
      | "extractPdfText"
    >,
  ) =>
  async (input: {
    bytes: Uint8Array;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    runtimeId?: string;
  }): Promise<{
    content: PipelineAgentContextArtifactContent;
    kind: PipelineAgentContextArtifactKind;
  }> => {
    const extension = extname(input.filename).toLowerCase();
    const textExtensions = new Set([".txt", ".md", ".json", ".csv", ".yaml", ".yml"]);
    const documentExtensions = new Set([".pdf", ".docx"]);

    if (input.mimeType.startsWith("image/")) {
      const [settings, runtimes] = await Promise.all([
        serviceBindings.settingsDao.get(),
        serviceBindings.agentRuntimesDao.findMany(),
      ]);
      const runtime = (0, serviceBindings.resolveAttachmentRuntime)({
        requestedRuntimeId: input.runtimeId,
        runtimes,
        defaultRuntime: settings.defaultAgentRuntime ?? null,
      });
      if (!runtime) {
        throw createRuntimeNotFoundError(input.runtimeId);
      }

      return (0, serviceBindings.createImageSummaryArtifact)({
        bytes: input.bytes,
        filename: input.filename,
        mimeType: input.mimeType,
        runtime,
        apiKey: settings.defaultApiKey,
        model: settings.defaultModel,
      });
    }

    if (textExtensions.has(extension) || input.mimeType.startsWith("text/")) {
      const text = (0, serviceBindings.decodeText)(input.bytes);

      return {
        kind: extension === ".json" || extension === ".csv" ? "structured_summary" : "text_extract",
        content: {
          text,
          summary: text.slice(0, 4000),
          mediaType: input.mimeType,
        },
      };
    }

    if (documentExtensions.has(extension)) {
      const extractedText =
        extension === ".docx"
          ? await (0, serviceBindings.extractDocxText)(input.bytes)
          : (0, serviceBindings.extractPdfText)(input.bytes);

      return {
        kind: "document_extract",
        content: {
          text: extractedText,
          summary:
            extractedText.length > 0
              ? extractedText.slice(0, 4000)
              : `Document uploaded: ${input.filename}.`,
          mediaType: input.mimeType,
          metadata: {
            filename: input.filename,
            extension,
            sizeBytes: input.sizeBytes,
          },
        },
      };
    }

    return {
      kind: "structured_summary",
      content: {
        summary: `Attachment uploaded: ${input.filename}`,
        mediaType: input.mimeType,
        metadata: {
          filename: input.filename,
          extension,
          sizeBytes: input.sizeBytes,
        },
      },
    };
  };
