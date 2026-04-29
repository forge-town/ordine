import { execFile } from "node:child_process";
import { logger } from "@repo/logger";

export interface OpenclawPayload {
  text: string;
  mediaUrl?: string;
}

export interface OpenclawMeta {
  durationMs?: number;
  finalAssistantRawText?: string;
  stopReason?: string;
  aborted?: boolean;
}

export interface OpenclawJsonResponse {
  runId: string;
  status: string;
  summary: string;
  result: {
    payloads: OpenclawPayload[];
    meta: OpenclawMeta;
  };
}

export interface RunOpenclawOptions {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  sessionId?: string;
  agentName?: string;
  timeoutMs?: number;
  onProgress?: (line: string) => Promise<void> | void;
}

export interface RunOpenclawResult {
  text: string;
  meta: OpenclawMeta;
  runId: string;
}

const OPENCLAW_BIN = "openclaw";

// openclaw suppresses --json output when test-related env vars are present
// (NODE_ENV=test, TEST=true, VITEST=true, etc.). Strip them.
const TEST_ENV_KEYS = new Set([
  "NODE_ENV",
  "TEST",
  "VITEST",
  "VITEST_MODE",
  "VITEST_POOL_ID",
  "VITEST_WORKER_ID",
  "JEST_WORKER_ID",
]);

/**
 *
 * @returns 根因：openclaw CLI 检测到 NODE_ENV=test / TEST=true / VITEST=true 等环境变量时会吞掉 --json 的 stdout 输出。
 *
 * 修复：在 runOpenclaw.ts 中用 cleanEnv() 剥离 test 相关环境变量后传给 execFile。回到最简洁的 execFile 方案，无需 shell redirect 或 spawn。
 */
const cleanEnv = (): NodeJS.ProcessEnv => {
  const env = { ...process.env };
  for (const key of TEST_ENV_KEYS) {
    delete env[key];
  }

  return env;
};

export const runOpenclaw = async ({
  systemPrompt,
  userPrompt,
  cwd,
  sessionId,
  agentName,
  timeoutMs = 10 * 60 * 1000,
  onProgress,
}: RunOpenclawOptions): Promise<RunOpenclawResult> => {
  const message = systemPrompt ? `${systemPrompt}\n\n${userPrompt}` : userPrompt;

  const args = ["agent", "--json"];

  if (agentName) {
    args.push("--agent", agentName);
  } else {
    args.push("--session-id", sessionId ?? `ordine-${Date.now()}`);
  }

  args.push("--message", message);

  logger.info({ cwd, agentName, sessionId }, "runOpenclaw: starting");
  await onProgress?.(`[OpenClaw] Starting openclaw agent (cwd=${cwd})...`);

  return new Promise<RunOpenclawResult>((resolve, reject) => {
    execFile(
      OPENCLAW_BIN,
      args,
      {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: cleanEnv(),
      },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          const code = error.code ?? "UNKNOWN";
          const errMsg = `openclaw exited with code ${code}: ${stderr || error.message}`;
          logger.error({ code, stderr }, errMsg);
          void onProgress?.(`[OpenClaw] Error: ${errMsg}`);
          reject(new Error(errMsg));

          return;
        }

        try {
          const response = JSON.parse(stdout) as OpenclawJsonResponse;
          const text = response.result?.payloads?.map((p) => p.text).join("\n") ?? "";
          const meta = response.result?.meta ?? {};

          logger.info(
            { cwd, textLen: text.length, runId: response.runId },
            "runOpenclaw: finished",
          );
          void onProgress?.(`[OpenClaw] ${text.slice(0, 200)}`);
          resolve({ text, meta, runId: response.runId });
        } catch {
          const errMsg = `openclaw returned invalid JSON: ${stdout.slice(0, 200)}`;
          logger.error({ stdout: stdout.slice(0, 500) }, errMsg);
          reject(new Error(errMsg));
        }
      },
    );
  });
};
