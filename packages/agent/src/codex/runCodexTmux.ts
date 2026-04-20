import { logger } from "@repo/logger";
import { runInTmux, shellQuote, type RunInTmuxResult } from "../tmux/runInTmux";

export interface RunCodexTmuxOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (line: string) => Promise<void>;
  onSessionCreated?: (sessionName: string) => Promise<void>;
}

const CODEX_BIN = "codex";
const MAX_INPUT_CHARS = 50_000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_POLL_INTERVAL_MS = 3000;

const buildCodexCommand = ({
  sandbox,
  model,
  cwd,
}: {
  sandbox: string;
  model?: string;
  cwd: string;
}): string => {
  const parts = [
    CODEX_BIN,
    "exec",
    "--sandbox",
    shellQuote(sandbox),
    "--ephemeral",
    "--skip-git-repo-check",
    "-C",
    shellQuote(cwd),
  ];

  if (model) {
    parts.push("--model", shellQuote(model));
  }

  return parts.join(" ");
};

const truncatePrompt = (userPrompt: string): string => {
  if (userPrompt.length <= MAX_INPUT_CHARS) return userPrompt;

  return `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`;
};

export const runCodexTmux = async ({
  systemPrompt,
  userPrompt,
  cwd,
  sandbox = "read-only",
  model,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onProgress,
  onSessionCreated,
}: RunCodexTmuxOptions): Promise<RunInTmuxResult> => {
  const truncatedPrompt = truncatePrompt(userPrompt);
  const prompt = `<system>${systemPrompt}</system>\n\n${truncatedPrompt}`;
  const command = buildCodexCommand({ sandbox, model, cwd });

  logger.info({ cwd, sandbox }, "runCodexTmux: delegating to runInTmux");

  return runInTmux({
    command,
    stdinContent: prompt,
    cwd,
    label: "Codex",
    timeoutMs,
    pollIntervalMs,
    onProgress,
    onSessionCreated,
  });
};
