import { Result } from "neverthrow";

type ProjectedPipelineAgentMessage =
  | { type: "assistant_chunk"; text: string }
  | { type: "progress"; message: string }
  | null;

const parseJson = Result.fromThrowable(
  (text: string) => JSON.parse(text) as unknown,
  () => undefined,
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Returns undefined for ordinary text, null for recognized protocol-only messages. */
export const projectPipelineAgentMessage = (
  text: string,
): ProjectedPipelineAgentMessage | undefined => {
  const parsed = parseJson(text.trim());
  if (parsed.isErr() || !isRecord(parsed.value)) return undefined;
  const value = parsed.value;

  if (typeof value["status"] === "string") {
    return typeof value["message"] === "string"
      ? { type: "progress", message: value["message"] }
      : null;
  }
  if (value["type"] === "question" && typeof value["question"] === "string") {
    return { type: "assistant_chunk", text: value["question"] };
  }
  if (value["type"] !== "proposal" || !isRecord(value["proposal"])) return undefined;

  const proposal = value["proposal"];
  const preview =
    typeof proposal["purpose"] === "string"
      ? proposal["purpose"]
      : typeof proposal["summary"] === "string"
        ? proposal["summary"]
        : null;

  return preview ? { type: "assistant_chunk", text: preview } : null;
};
