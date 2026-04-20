import { execFile } from "node:child_process";
import { logger } from "@repo/logger";

const TMUX_BIN = "tmux";

export const buildSessionName = (): string => {
  const id = Math.random().toString(36).slice(2, 10);

  return `ordine-codex-${id}`;
};

const execTmux = (args: string[]): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(TMUX_BIN, args, (error, stdout, stderr) => {
      if (error) {
        logger.debug({ args, stderr }, "tmux: command failed");
        reject(error);

        return;
      }

      resolve(stdout);
    });
  });

export interface CreateTmuxSessionOptions {
  sessionName: string;
  command: string;
  cwd: string;
}

export const createTmuxSession = async ({
  sessionName,
  command,
  cwd,
}: CreateTmuxSessionOptions): Promise<void> => {
  logger.info({ sessionName, cwd }, "tmux: creating session");
  await execTmux(["new-session", "-d", "-s", sessionName, "-c", cwd, command]);
};

export const capturePane = async (sessionName: string): Promise<string> => {
  const content = await execTmux(["capture-pane", "-t", sessionName, "-p", "-S", "-"]);

  return content;
};

export const killTmuxSession = async (sessionName: string): Promise<void> => {
  logger.info({ sessionName }, "tmux: killing session");
  const result = await execTmux(["kill-session", "-t", sessionName]).then(
    () => true,
    () => false,
  );
  if (!result) {
    logger.debug({ sessionName }, "tmux: session already dead");
  }
};

export const isTmuxSessionAlive = async (sessionName: string): Promise<boolean> => {
  const alive = await execTmux(["has-session", "-t", sessionName]).then(
    () => true,
    () => false,
  );

  return alive;
};

export const sendKeys = async (sessionName: string, text: string): Promise<void> => {
  await execTmux(["send-keys", "-t", sessionName, text, "Enter"]);
};
