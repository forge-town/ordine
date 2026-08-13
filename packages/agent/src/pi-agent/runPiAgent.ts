import { logger } from "@repo/logger";
import { ResultAsync } from "neverthrow";
import { runCliToCompletion } from "../spawn";

export interface RunPiAgentOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

const PI_BIN = "pi";

const buildPrompt = (systemPrompt: string, userPrompt: string): string => {
  if (!systemPrompt) {
    return userPrompt;
  }

  return `${systemPrompt}\n\n${userPrompt}`;
};

export const runPiAgent = ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunPiAgentOptions): ResultAsync<string, Error> => {
  // --print: non-interactive, process the prompt and exit.
  // --no-session: one-shot execution, don't persist a session file.
  // --no-extensions: skip user extension discovery so a broken local
  // extension can't fail an unattended run.
  const args = ["--print", "--no-session", "--no-extensions", buildPrompt(systemPrompt, userPrompt)];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, model }, "runPiAgent: starting");
  const startProgress = ResultAsync.fromSafePromise(
    Promise.resolve(onProgress?.(`[Pi] Starting pi --print (cwd=${cwd})...`)),
  );

  return startProgress.andThen(() =>
    ResultAsync.fromSafePromise(
      runCliToCompletion({
        command: PI_BIN,
        args,
        cwd,
        timeoutMs,
        label: "Pi",
        onProgress,
      }),
    ).andThen((result) => result),
  );
};
