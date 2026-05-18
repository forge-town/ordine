import { execFile } from "node:child_process";
import { logger } from "@repo/logger";
import { err, errAsync, ok, ResultAsync, type Result } from "neverthrow";

export interface RunHermesOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  allowedTools?: readonly string[];
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

const HERMES_BIN = "hermes";
export const MAX_HERMES_PROMPT_ARG_CHARS = 20_000;
const HERMES_SAFE_TOOLSETS = ["safe"] as const;
const HERMES_SAFE_TOOL_NAMES = ["WebSearch", "WebFetch"] as const;
const HERMES_SAFE_TOOL_NAME_SET = new Set<string>(HERMES_SAFE_TOOL_NAMES);

const buildPrompt = (systemPrompt: string, userPrompt: string): string => {
  if (!systemPrompt) {
    return userPrompt;
  }

  return `${systemPrompt}\n\n${userPrompt}`;
};

const buildToolsetArgs = (allowedTools: readonly string[] = []): Result<string[], Error> => {
  if (allowedTools.length === 0) {
    return ok([]);
  }

  const unsupportedTools = allowedTools.filter((tool) => !HERMES_SAFE_TOOL_NAME_SET.has(tool));
  if (unsupportedTools.length > 0) {
    return err(
      new Error(
        `Hermes cannot safely honor local tool permissions: ${unsupportedTools.join(", ")}`,
      ),
    );
  }

  const missingSafeTools = HERMES_SAFE_TOOL_NAMES.filter((tool) => !allowedTools.includes(tool));
  if (missingSafeTools.length > 0) {
    return err(
      new Error(
        `Hermes cannot safely enable a partial safe toolset; missing permissions: ${missingSafeTools.join(", ")}`,
      ),
    );
  }

  return ok(["--toolsets", HERMES_SAFE_TOOLSETS.join(",")]);
};

const execHermes = ({
  args,
  cwd,
  timeoutMs,
  onProgress,
}: {
  args: string[];
  cwd: string;
  timeoutMs: number;
  onProgress?: RunHermesOptions["onProgress"];
}): Promise<Result<string, Error>> =>
  new Promise((resolve) => {
    execFile(
      HERMES_BIN,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env },
      },
      (error, stdout, stderr) => {
        const text = String(stdout);
        const stderrText = String(stderr).trim();

        if (error) {
          const code = error.code ?? "UNKNOWN";
          const diagnostic = stderrText || error.message;
          const errMsg = `hermes exited with code ${code}: ${diagnostic}`;
          logger.error({ code, stderr: stderrText.slice(0, 500) }, "runHermes: non-zero exit");
          void onProgress?.(`[Hermes] Error: ${errMsg.slice(0, 200)}`);
          resolve(err(new Error(errMsg)));

          return;
        }

        if (text.trim().length === 0) {
          logger.error({ stderr: stderrText.slice(0, 500) }, "runHermes: empty output");
          void onProgress?.("[Hermes] Empty output");
          resolve(err(new Error("hermes returned empty output")));

          return;
        }

        logger.info({ len: text.length }, "runHermes: complete");
        void onProgress?.(`[Hermes] Complete (${text.length} chars)`);
        resolve(ok(text));
      },
    );
  });

export const runHermes = ({
  systemPrompt,
  userPrompt,
  cwd,
  model,
  allowedTools,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunHermesOptions): ResultAsync<string, Error> => {
  const prompt = buildPrompt(systemPrompt, userPrompt);
  if (prompt.length > MAX_HERMES_PROMPT_ARG_CHARS) {
    return errAsync(
      new Error(
        `Hermes prompt is too large for CLI argument mode: ${prompt.length} chars (max ${MAX_HERMES_PROMPT_ARG_CHARS})`,
      ),
    );
  }

  const toolsetArgs = buildToolsetArgs(allowedTools);
  if (toolsetArgs.isErr()) {
    return errAsync(toolsetArgs.error);
  }

  const args = ["-z", prompt, ...toolsetArgs.value];

  if (model) {
    args.push("--model", model);
  }

  logger.info({ cwd, model }, "runHermes: starting");
  const startProgress = ResultAsync.fromSafePromise(
    Promise.resolve(onProgress?.(`[Hermes] Starting hermes -z (cwd=${cwd})...`)),
  );

  return startProgress.andThen(() =>
    ResultAsync.fromSafePromise(execHermes({ args, cwd, timeoutMs, onProgress })).andThen(
      (result) => result,
    ),
  );
};
