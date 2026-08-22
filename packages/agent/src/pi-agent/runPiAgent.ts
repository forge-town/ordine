import type { RuntimeEvent } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { runPiRpcSession, type PiRpcImage } from "../runtime/runPiRpcSession";

export type PiAgentImageAttachment = {
  kind: "image";
  mediaType: string;
  dataBase64: string;
};

export type RunPiAgentOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  thinking?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  timeoutMs?: number;
  signal?: AbortSignal;
  attachments?: readonly PiAgentImageAttachment[];
  resumeSessionId?: string;
  onProgress?: (line: string) => Promise<void> | void;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const toPiImages = (attachments: readonly PiAgentImageAttachment[] | undefined): PiRpcImage[] =>
  (attachments ?? []).map((attachment) => ({
    type: "image",
    data: attachment.dataBase64,
    mimeType: attachment.mediaType,
  }));

export const runPiAgent = (options: RunPiAgentOptions): ResultAsync<string, Error> => {
  const args = ["--mode", "rpc"];
  if (options.model && options.model !== "default") args.push("--model", options.model);
  if (options.thinking) args.push("--thinking", options.thinking);

  return ResultAsync.fromPromise(
    runPiRpcSession({
      command: process.env.PI_BIN ?? "pi",
      args,
      cwd: options.cwd,
      prompt: options.systemPrompt
        ? `${options.systemPrompt}\n\n${options.userPrompt}`
        : options.userPrompt,
      timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
      signal: options.signal,
      images: toPiImages(options.attachments),
      parentSession: options.resumeSessionId,
      onEvent: options.onRuntimeEvent,
    }),
    toError,
  ).andThen((result) => result.map((value) => value.text));
};
