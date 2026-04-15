import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { readFile, mkdir } from "node:fs/promises";
import { statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Result, ResultAsync, ok, okAsync, errAsync } from "neverthrow";
import { ScriptExecutionError, GitCloneError, ConfigParseError } from "./errors.js";
import type { OperationConfig } from "./schemas/index.js";
import type { ExecutorConfig } from "./schemas/index.js";

const execAsync = promisify(exec);

export const safeParseJson = (
  raw: string,
  operationName: string,
): ResultAsync<OperationConfig, ConfigParseError> => {
  const parse = Result.fromThrowable(
    (r: string) => JSON.parse(r) as OperationConfig,
    (cause) => new ConfigParseError(operationName, cause),
  );
  const result = parse(raw);
  return result.isOk() ? okAsync(result.value) : errAsync(result.error);
};

export const safeReadInputFile = (
  path: string,
): ResultAsync<{ content: string; isFile: boolean }, never> =>
  ResultAsync.fromPromise(
    (async () => {
      const stat = statSync(path);
      if (stat.isFile()) {
        const content = await readFile(path, "utf8");
        return { content, isFile: true };
      }
      return { content: path, isFile: false };
    })(),
    () => ({ content: path, isFile: false }),
  ).orElse((fallback) => ok(fallback));

export const runScript = (
  executor: ExecutorConfig,
  inputPath: string,
  inputContent: string,
): ResultAsync<string, ScriptExecutionError> => {
  const lang = executor.language ?? "bash";
  const command = executor.command ?? "";
  if (!command.trim()) {
    return errAsync(new ScriptExecutionError("Script command is empty"));
  }

  const env = {
    ...process.env,
    INPUT_PATH: inputPath,
    INPUT_CONTENT: inputContent,
  };

  const buildCmd = (): string => {
    if (lang === "python") return `python3 -c ${JSON.stringify(command)}`;
    if (lang === "javascript") return `node -e ${JSON.stringify(command)}`;
    if (lang === "bash") return command;
    return `__UNSUPPORTED_LANG_${lang}__`;
  };

  return ResultAsync.fromPromise(
    (async () => {
      const cmd = buildCmd();
      if (cmd.startsWith("__UNSUPPORTED_LANG_")) {
        return Promise.reject(new ScriptExecutionError(`Unknown script language: ${lang}`));
      }
      const { stdout } = await execAsync(cmd, { env, timeout: 60_000 });
      return stdout;
    })(),
    (cause) =>
      new ScriptExecutionError(
        `Script execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
  );
};

export const cloneGitHubRepo = (
  owner: string,
  repo: string,
  branch: string,
  githubToken?: string,
): ResultAsync<string, GitCloneError> => {
  const cloneDir = join(tmpdir(), `ordine-pipeline-${Date.now()}-${repo}`);
  const url = githubToken
    ? `https://x-access-token:${githubToken}@github.com/${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;

  return ResultAsync.fromPromise(
    (async () => {
      await mkdir(cloneDir, { recursive: true });
      execSync(`git clone --depth 1 --branch ${branch} ${url} ${cloneDir}`, {
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        stdio: ["ignore", "pipe", "pipe"],
      });
      return cloneDir;
    })(),
    (cause) =>
      new GitCloneError(
        `Failed to clone ${owner}/${repo}@${branch}: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
  );
};
