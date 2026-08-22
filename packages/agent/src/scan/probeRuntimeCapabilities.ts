import type { AgentRuntime } from "@repo/schemas";
import { spawnCommand } from "../spawn/spawnCommand";

export type RuntimeCliCapabilities = {
  structuredOutput: boolean;
  partialMessages: boolean;
  resume: boolean;
  sessionId: boolean;
  skipPermissions: boolean;
};

const runHelp = (path: string, args: readonly string[]): Promise<string> =>
  new Promise((resolve) => {
    const child = spawnCommand(path, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });
    const chunks: Buffer[] = [];
    const state = { settled: false };
    child.stdin.end();
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    const timer = setTimeout(() => {
      if (state.settled) return;
      state.settled = true;
      child.kill("SIGTERM");
      resolve("");
    }, 5000);
    const finish = () => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    child.on("error", finish);
    child.on("close", finish);
  });

export const probeRuntimeCapabilities = async ({
  runtime,
  path,
}: {
  runtime: AgentRuntime;
  path: string;
}): Promise<RuntimeCliCapabilities> => {
  if (runtime === "claude-code") {
    const help = await runHelp(path, ["-p", "--help"]);

    return {
      structuredOutput: help.includes("--input-format") && help.includes("--output-format"),
      partialMessages: help.includes("--include-partial-messages"),
      resume: help.includes("--resume"),
      sessionId: help.includes("--session-id"),
      skipPermissions: false,
    };
  }
  if (runtime === "codex") {
    const [execHelp, resumeHelp] = await Promise.all([
      runHelp(path, ["exec", "--help"]),
      runHelp(path, ["exec", "resume", "--help"]),
    ]);

    return {
      structuredOutput: execHelp.includes("--json"),
      partialMessages: false,
      resume: resumeHelp.length > 0 && !/unrecognized|unexpected argument/i.test(resumeHelp),
      sessionId: false,
      skipPermissions: false,
    };
  }
  if (runtime === "opencode") {
    const help = await runHelp(path, ["run", "--help"]);

    return {
      structuredOutput: help.includes("--format") && /json/i.test(help),
      partialMessages: false,
      resume: help.includes("--session") || /(?:^|\s)-s(?:,|\s)/m.test(help),
      sessionId: false,
      skipPermissions: help.includes("--dangerously-skip-permissions"),
    };
  }

  return {
    structuredOutput: false,
    partialMessages: false,
    resume: false,
    sessionId: false,
    skipPermissions: false,
  };
};
