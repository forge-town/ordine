import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createReadHexPdfStringHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "decodePdfTextBytes">) =>
  (input: string, startIndex: number) => {
    const endIndex = input.indexOf(">", startIndex + 1);
    if (endIndex === -1) {
      return { value: "", nextIndex: input.length };
    }

    const rawHex = input.slice(startIndex + 1, endIndex).replaceAll(/\s+/g, "");
    const normalizedHex = rawHex.length % 2 === 0 ? rawHex : `${rawHex}0`;
    const bytes = Array.from({ length: Math.floor(normalizedHex.length / 2) }, (_, offset) =>
      Number.parseInt(normalizedHex.slice(offset * 2, offset * 2 + 2), 16),
    ).filter((value) => !Number.isNaN(value));

    return { value: (0, serviceBindings.decodePdfTextBytes)(bytes), nextIndex: endIndex + 1 };
  };
