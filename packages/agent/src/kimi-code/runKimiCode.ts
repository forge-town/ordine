import { logger } from "@repo/logger";
import { ResultAsync } from "neverthrow";
import { runCliToCompletion } from "../spawn";

export interface RunKimiCodeOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

const KIMI_BIN = "kimi";

const buildPrompt = (systemPrompt: string, userPrompt: string): string => {
  if (!systemPrompt) {
    return userPrompt;
  }

  return `${systemPrompt}\n\n${userPrompt}`;
};

export const runKimiCode = ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunKimiCodeOptions): ResultAsync<string, Error> => {
  // --quiet = --print + text output + final message only (non-interactive,
  // auto-approves tool calls for this invocation).
  const args = [
    "--quiet",
    "--work-dir",
    cwd,
    "--prompt",
    buildPrompt(systemPrompt, userPrompt),
  ];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, model }, "runKimiCode: starting");
  const startProgress = ResultAsync.fromSafePromise(
    Promise.resolve(onProgress?.(`[Kimi] Starting kimi --quiet (cwd=${cwd})...`)),
  );

  return startProgress.andThen(() =>
    ResultAsync.fromSafePromise(
      runCliToCompletion({
        command: KIMI_BIN,
        args,
        cwd,
        timeoutMs,
        label: "Kimi",
        onProgress,
      }),
    ).andThen((result) => result),
  );
};
