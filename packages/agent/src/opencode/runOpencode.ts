import { logger } from "@repo/logger";
import { ResultAsync } from "neverthrow";
import { runCliToCompletion } from "../spawn";

export interface RunOpencodeOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

const OPENCODE_BIN = "opencode";

const buildPrompt = (systemPrompt: string, userPrompt: string): string => {
  if (!systemPrompt) {
    return userPrompt;
  }

  return `${systemPrompt}\n\n${userPrompt}`;
};

export const runOpencode = ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunOpencodeOptions): ResultAsync<string, Error> => {
  // `opencode run` is the headless one-shot mode: run the message and exit.
  const args = ["run", buildPrompt(systemPrompt, userPrompt)];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, model }, "runOpencode: starting");
  const startProgress = ResultAsync.fromSafePromise(
    Promise.resolve(onProgress?.(`[Opencode] Starting opencode run (cwd=${cwd})...`)),
  );

  return startProgress.andThen(() =>
    ResultAsync.fromSafePromise(
      runCliToCompletion({
        command: OPENCODE_BIN,
        args,
        cwd,
        timeoutMs,
        label: "Opencode",
        onProgress,
      }),
    ).andThen((result) => result),
  );
};
