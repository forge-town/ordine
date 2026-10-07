import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createExtractPdfTextHelper =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      "extractPdfStreamBodies" | "extractPdfTextTokens" | "normalizeWhitespace"
    >,
  ) =>
  (bytes: Uint8Array) => {
    const streamBodies = (0, serviceBindings.extractPdfStreamBodies)(bytes);
    const textSegments = streamBodies.flatMap((body) =>
      (0, serviceBindings.extractPdfTextTokens)(body),
    );

    return (0, serviceBindings.normalizeWhitespace)(textSegments.join(" "));
  };
