import { logger } from "@repo/logger";
import { runInTmux, shellQuote } from "../tmux/runInTmux";
import type { RunClaudeResult } from "./schemas/RunClaudeResultSchema";
import type { ToolName } from "./schemas/ToolNameSchema";

export interface RunClaudeTmuxOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  allowedTools?: readonly ToolName[];
  timeoutMs?: number;
  maxBudgetUsd?: number;
  pollIntervalMs?: number;
  onProgress?: (line: string) => Promise<void>;
  onSessionCreated?: (sessionName: string) => Promise<void>;
}

const CLAUDE_BIN = "/Users/amin/.local/bin/claude";
const MAX_INPUT_CHARS = 50_000;
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

const DEFAULT_READ_ONLY_TOOLS: readonly ToolName[] = [
  "Read",
  "Bash(find:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(cat:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
  "Bash(ls:*)",
  "Bash(tree:*)",
];

const truncatePrompt = (userPrompt: string): string => {
  if (userPrompt.length <= MAX_INPUT_CHARS) return userPrompt;

  return `${userPrompt.slice(0, MAX_INPUT_CHARS)}\n\n... (truncated, ${userPrompt.length - MAX_INPUT_CHARS} chars omitted — use tools to explore the project)`;
};

const buildClaudeCommand = ({
  systemPrompt,
  allowedTools,
  maxBudgetUsd,
}: {
  systemPrompt: string;
  allowedTools: readonly ToolName[];
  maxBudgetUsd: number;
}): string => {
  const parts = [
    CLAUDE_BIN,
    "-p",
    "--verbose",
    "--system-prompt",
    shellQuote(systemPrompt),
    "--allowedTools",
    shellQuote(allowedTools.join(",")),
    "--dangerously-skip-permissions",
    "--no-session-persistence",
    "--max-budget-usd",
    String(maxBudgetUsd),
  ];

  return parts.join(" ");
};

/**
 * Run Claude CLI inside a tmux session for live terminal observability.
 *
 * Trade-off: you get a live-observable tmux pane you can attach to,
 * but lose the structured ClaudeStreamEvent stream (events will be empty).
 */
export const runClaudeTmux = async ({
  systemPrompt,
  userPrompt,
  cwd,
  allowedTools = DEFAULT_READ_ONLY_TOOLS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBudgetUsd = 5,
  pollIntervalMs,
  onProgress,
  onSessionCreated,
}: RunClaudeTmuxOptions): Promise<RunClaudeResult & { sessionName: string }> => {
  const truncatedPrompt = truncatePrompt(userPrompt);
  const command = buildClaudeCommand({
    systemPrompt,
    allowedTools,
    maxBudgetUsd,
  });

  logger.info({ cwd }, "runClaudeTmux: delegating to runInTmux");

  const { output, sessionName } = await runInTmux({
    command,
    stdinContent: truncatedPrompt,
    cwd,
    label: "Claude",
    timeoutMs,
    pollIntervalMs,
    onProgress,
    onSessionCreated,
  });

  return { text: output, events: [], sessionName };
};
