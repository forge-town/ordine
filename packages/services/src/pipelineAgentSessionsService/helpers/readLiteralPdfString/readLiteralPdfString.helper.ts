import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createReadLiteralPdfStringHelper =
  (_serviceBindings: Pick<PipelineAgentSessionsServiceBindings, never>) =>
  (input: string, startIndex: number) => {
    const readNext = (
      index: number,
      depth: number,
      value: string,
    ): { nextIndex: number; value: string } => {
      if (index >= input.length || depth <= 0) {
        return { value, nextIndex: index };
      }

      const char = input[index]!;
      if (char === "\\") {
        const escaped = input[index + 1];
        if (!escaped) {
          return readNext(index + 1, depth, value);
        }
        if (/[0-7]/.test(escaped)) {
          const octal = input.slice(index + 1, index + 4).match(/^[0-7]{1,3}/)?.[0] ?? "";

          return readNext(
            index + 1 + octal.length,
            depth,
            `${value}${String.fromCodePoint(Number.parseInt(octal, 8))}`,
          );
        }
        const escapedMap: Record<string, string> = {
          n: "\n",
          r: "\r",
          t: "\t",
          b: "\b",
          f: "\f",
          "(": "(",
          ")": ")",
          "\\": "\\",
        };

        return readNext(index + 2, depth, `${value}${escapedMap[escaped] ?? escaped}`);
      }
      if (char === "(") {
        return readNext(index + 1, depth + 1, `${value}${char}`);
      }
      if (char === ")") {
        const nextDepth = depth - 1;

        return readNext(index + 1, nextDepth, nextDepth > 0 ? `${value}${char}` : value);
      }

      return readNext(index + 1, depth, `${value}${char}`);
    };

    return readNext(startIndex + 1, 1, "");
  };
