import { inflateSync } from "node:zlib";

import { Result } from "neverthrow";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createExtractPdfStreamBodiesHelper =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "decodePdfBinary">) =>
  (bytes: Uint8Array) => {
    const raw = (0, serviceBindings.decodePdfBinary)(bytes);
    const readBodies = (searchIndex: number, bodies: string[]): string[] => {
      if (searchIndex >= raw.length) {
        return bodies;
      }

      const streamIndex = raw.indexOf("stream", searchIndex);
      if (streamIndex === -1) {
        return bodies;
      }
      const bodyStartBeforeLineBreak = streamIndex + "stream".length;
      const bodyStart =
        raw[bodyStartBeforeLineBreak] === "\r" && raw[bodyStartBeforeLineBreak + 1] === "\n"
          ? bodyStartBeforeLineBreak + 2
          : raw[bodyStartBeforeLineBreak] === "\n" || raw[bodyStartBeforeLineBreak] === "\r"
            ? bodyStartBeforeLineBreak + 1
            : bodyStartBeforeLineBreak;
      const endIndex = raw.indexOf("endstream", bodyStart);
      if (endIndex === -1) {
        return bodies;
      }

      const dictionaryStart = raw.lastIndexOf("<<", streamIndex);
      const dictionaryEnd = raw.lastIndexOf(">>", streamIndex);
      const dictionary =
        dictionaryStart !== -1 && dictionaryEnd !== -1 && dictionaryEnd > dictionaryStart
          ? raw.slice(dictionaryStart, dictionaryEnd)
          : "";
      const bodyBytes = bytes.slice(bodyStart, endIndex);
      const decodedBytes = dictionary.includes("/FlateDecode")
        ? Result.fromThrowable(
            () => inflateSync(Buffer.from(bodyBytes)),
            (error) => error,
          )().unwrapOr(Buffer.from(bodyBytes))
        : Buffer.from(bodyBytes);

      return readBodies(endIndex + "endstream".length, [
        ...bodies,
        (0, serviceBindings.decodePdfBinary)(decodedBytes),
      ]);
    };

    const bodies = readBodies(0, []);

    return bodies.length > 0 ? bodies : [raw];
  };
