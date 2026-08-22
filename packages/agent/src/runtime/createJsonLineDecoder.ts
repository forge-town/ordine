import { Result } from "neverthrow";
import { createLineDecoder } from "./createLineDecoder";

export type JsonLineDiagnostic = {
  line: string;
  message: string;
};

const parseJsonLine = Result.fromThrowable(
  (line: string) => JSON.parse(line) as unknown,
  (error) => (error instanceof Error ? error.message : String(error)),
);

export const createJsonLineDecoder = ({
  onMessage,
  onMalformed,
}: {
  onMessage: (message: unknown, rawLine: string) => void;
  onMalformed?: (diagnostic: JsonLineDiagnostic) => void;
}) =>
  createLineDecoder((line) => {
    if (line.trim().length === 0) return;
    const parsed = parseJsonLine(line);
    if (parsed.isErr()) {
      onMalformed?.({ line, message: parsed.error });

      return;
    }
    onMessage(parsed.value, line);
  });
