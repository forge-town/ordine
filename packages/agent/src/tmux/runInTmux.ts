import { logger } from "@repo/logger";
import {
  buildSessionName,
  capturePane,
  createTmuxSession,
  isTmuxSessionAlive,
  killTmuxSession,
} from "./tmuxSession";

export interface RunInTmuxOptions {
  /** The shell command to execute inside the tmux pane */
  command: string;
  /** Optional content to pipe into the command via stdin (using printf for content safety) */
  stdinContent?: string;
  /** Working directory for the tmux session */
  cwd: string;
  /** Human-readable label used in progress messages (e.g. "codex", "claude") */
  label?: string;
  /** Maximum execution time before killing the session */
  timeoutMs?: number;
  /** How often to capture pane content for progress reporting */
  pollIntervalMs?: number;
  /** Callback invoked when new pane content is detected */
  onProgress?: (line: string) => Promise<void>;
  /** Callback fired once the tmux session is created, before polling starts */
  onSessionCreated?: (sessionName: string) => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;

export interface RunInTmuxResult {
  output: string;
  sessionName: string;
}

const DEFAULT_POLL_INTERVAL_MS = 3000;

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = /\u001B\[[0-9;]*[a-zA-Z]/g;

const stripAnsi = (text: string): string => text.replaceAll(ANSI_REGEX, "");

/**
 * Shell-quote a string using single quotes.
 * Single quotes inside the string are escaped as: '\''
 */
export const shellQuote = (s: string): string => `'${s.replaceAll("'", "'\\''")}'`;

const buildShellCommand = (command: string, stdinContent?: string): string => {
  if (!stdinContent) return command;
  // Use printf '%s' for content-safe stdin delivery (no backslash mangling, no trailing newline issues)
  return `printf '%s' ${shellQuote(stdinContent)} | ${command}`;
};

export const runInTmux = async ({
  command,
  stdinContent,
  cwd,
  label = "tmux",
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  onProgress,
  onSessionCreated,
}: RunInTmuxOptions): Promise<RunInTmuxResult> => {
  const sessionName = buildSessionName();
  const shellCommand = buildShellCommand(command, stdinContent);

  logger.info({ sessionName, cwd, label }, "runInTmux: starting");
  await onProgress?.(`[${label}/tmux] Starting session ${sessionName} (cwd=${cwd})...`);

  const cleanup = async () => {
    await killTmuxSession(sessionName);
  };

  await createTmuxSession({
    sessionName,
    command: shellCommand,
    cwd,
  }).catch(async (error) => {
    await cleanup();
    throw error;
  });

  await onSessionCreated?.(sessionName);

  const state = { lastContent: "", resolved: false };

  return new Promise<RunInTmuxResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (state.resolved) return;
      state.resolved = true;
      logger.error({ sessionName, timeoutMs, label }, "runInTmux: timed out");
      void (async () => {
        await onProgress?.(`[${label}/tmux] Timed out after ${timeoutMs / 1000}s`).catch(() => {});
        await cleanup().catch(() => {});
        reject(new Error(`${label} (tmux) timed out after ${timeoutMs / 1000}s`));
      })();
    }, timeoutMs);

    const poll = async () => {
      if (state.resolved) return;

      try {
        const alive = await isTmuxSessionAlive(sessionName);

        const rawContent = await capturePane(sessionName).catch(() => state.lastContent);
        const content = stripAnsi(rawContent);

        if (content !== state.lastContent) {
          state.lastContent = content;
          await onProgress?.(`[${label}/tmux] ${content.slice(-200)}`);
        }

        if (!alive) {
          state.resolved = true;
          clearTimeout(timer);

          logger.info({ sessionName, len: content.length, label }, "runInTmux: session exited");
          await onProgress?.(`[${label}/tmux] Session exited (${content.length} chars captured)`);
          await cleanup();
          resolve({ output: content, sessionName });

          return;
        }

        setTimeout(() => void poll(), pollIntervalMs);
      } catch (error) {
        if (state.resolved) return;
        state.resolved = true;
        clearTimeout(timer);
        logger.error({ err: error, sessionName }, "runInTmux: poll error");
        await cleanup().catch(() => {});
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    void poll();
  });
};
