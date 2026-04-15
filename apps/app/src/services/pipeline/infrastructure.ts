import { exec, execSync } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ResultAsync } from "neverthrow";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";
import { ScriptExecutionError, GitCloneError } from "./types";

const execAsync = promisify(exec);

export const runScript = (
  executor: ExecutorConfig,
  inputPath: string,
  inputContent: string,
): ResultAsync<string, ScriptExecutionError> => {
  const lang = executor.language ?? "bash";
  const command = executor.command ?? "";
  if (!command.trim()) {
    return ResultAsync.fromSafePromise<string, ScriptExecutionError>(
      Promise.reject(new ScriptExecutionError("Script command is empty")),
    );
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
    throw new ScriptExecutionError(`Unknown script language: ${lang}`);
  };

  return ResultAsync.fromPromise(
    (async () => {
      const cmd = buildCmd();
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
