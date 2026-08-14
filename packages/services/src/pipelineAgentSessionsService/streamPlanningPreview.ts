import type { PipelineAgentMode } from "@repo/schemas";

const findValueStart = (text: string, fields: readonly string[]): number | null => {
  let earliestStart: number | null = null;

  for (const field of fields) {
    const match = new RegExp(`"${field}"\\s*:\\s*"`).exec(text);
    if (!match) continue;
    const valueStart = match.index + match[0].length;
    if (earliestStart === null || valueStart < earliestStart) earliestStart = valueStart;
  }

  return earliestStart;
};

const decodeJsonStringPrefix = (value: string): string => {
  let decoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') break;
    if (character !== "\\") {
      decoded += character;
      continue;
    }

    const escaped = value[index + 1];
    if (!escaped) break;
    if (escaped === "u") {
      const codePoint = value.slice(index + 2, index + 6);
      if (!/^[0-9a-f]{4}$/i.test(codePoint)) break;
      decoded += String.fromCharCode(Number.parseInt(codePoint, 16));
      index += 5;
      continue;
    }

    const escapedCharacters: Record<string, string> = {
      '"': '"',
      "\\": "\\",
      "/": "/",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
    };
    const decodedEscape = escapedCharacters[escaped];
    if (decodedEscape === undefined) break;
    decoded += decodedEscape;
    index += 1;
  }

  return decoded;
};

export const createPlanningPreviewStreamer = ({
  mode,
  onChunk,
}: {
  mode: PipelineAgentMode;
  onChunk?: (text: string) => Promise<void> | void;
}) => {
  const fields = mode === "generate" ? ["question", "purpose"] : ["question", "summary"];
  let rawText = "";
  let valueStart: number | null = null;
  let emittedText = "";

  return (chunk: string): void => {
    rawText += chunk;
    valueStart ??= findValueStart(rawText, fields);
    if (valueStart === null) return;

    const previewText = decodeJsonStringPrefix(rawText.slice(valueStart));
    if (!previewText.startsWith(emittedText) || previewText.length === emittedText.length) return;

    const nextChunk = previewText.slice(emittedText.length);
    emittedText = previewText;
    void onChunk?.(nextChunk);
  };
};
