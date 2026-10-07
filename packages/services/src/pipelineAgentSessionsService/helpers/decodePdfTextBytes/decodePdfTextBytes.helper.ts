import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createDecodePdfTextBytesHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) => (bytes: number[]) => {
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      return Array.from({ length: Math.floor((bytes.length - 2) / 2) }, (_, offset) => {
        const index = 2 + offset * 2;

        return String.fromCodePoint((bytes[index]! << 8) | bytes[index + 1]!);
      }).join("");
    }

    return Buffer.from(bytes).toString("utf8");
  };
