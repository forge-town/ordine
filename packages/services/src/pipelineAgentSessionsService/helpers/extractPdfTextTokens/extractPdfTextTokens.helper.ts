import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createExtractPdfTextTokensHelper =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      "readLiteralPdfString" | "readHexPdfString"
    >,
  ) =>
  (input: string) => {
    const readTokens = (index: number, segments: string[]): string[] => {
      if (index >= input.length) {
        return segments;
      }

      const char = input[index]!;
      if (char === "(") {
        const parsed = (0, serviceBindings.readLiteralPdfString)(input, index);

        return readTokens(parsed.nextIndex, [...segments, parsed.value]);
      }
      if (char === "<" && input[index + 1] !== "<") {
        const parsed = (0, serviceBindings.readHexPdfString)(input, index);

        return readTokens(parsed.nextIndex, parsed.value ? [...segments, parsed.value] : segments);
      }

      return readTokens(index + 1, segments);
    };

    return readTokens(0, []);
  };
