import type { ChildProcessWithoutNullStreams, SpawnOptions } from "node:child_process";
import { err, ok, type Result } from "neverthrow";
import {
  RuntimeExecutionResultSchema,
  type AgentRuntime,
  type RuntimeEvent,
  type RuntimeExecutionResult,
  type RuntimeTerminalStatus,
} from "@repo/schemas";
import { spawnCommand } from "../spawn/spawnCommand";
import { createLineDecoder } from "./createLineDecoder";
import { createRuntimeEventEmitter, type RuntimeEventPayload } from "./runtimeEventEmitter";
import { terminateRuntimeProcess } from "./terminateRuntimeProcess";

export type RuntimeSpawn = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcessWithoutNullStreams;

export class RuntimeProcessError extends Error {
  constructor(
    message: string,
    public readonly result: RuntimeExecutionResult,
  ) {
    super(message);
    this.name = "RuntimeProcessError";
  }
}

export type RuntimeStdoutLineHandler = (
  line: string,
  emit: (payload: RuntimeEventPayload) => RuntimeEvent,
) => void;

export type RunRuntimeProcessOptions = {
  runtime: AgentRuntime;
  command: string;
  args: readonly string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  stdin?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  onStdoutLine?: RuntimeStdoutLineHandler;
  onEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

const terminalMessage = (
  status: RuntimeTerminalStatus,
  command: string,
  code: number | null,
  signal: NodeJS.Signals | null,
  stderr: string,
): string => {
  if (status === "timed_out") return `${command} timed out`;
  if (status === "cancelled") return `${command} was cancelled`;
  if (status === "failed") {
    const diagnostic = stderr.trim() || `exit code ${code ?? signal ?? "unknown"}`;

    return `${command} failed: ${diagnostic}`;
  }

  return `${command} completed`;
};

export const runRuntimeProcess = (
  options: RunRuntimeProcessOptions,
  spawnRuntime: RuntimeSpawn = spawnCommand,
): Promise<Result<RuntimeExecutionResult, RuntimeProcessError>> =>
  new Promise((resolve) => {
    const events: RuntimeEvent[] = [];
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const state = {
      settled: false,
      requestedTerminal: null as "cancelled" | "timed_out" | null,
    };
    const eventEmitter = createRuntimeEventEmitter({
      runtime: options.runtime,
      onEvent: options.onEvent,
    });
    const emit = (payload: RuntimeEventPayload): RuntimeEvent => {
      const event = eventEmitter.emit(payload);
      events.push(event);

      return event;
    };
    const stdout = createLineDecoder((line) => {
      stdoutLines.push(line);
      if (options.onStdoutLine) {
        options.onStdoutLine(line, emit);
      } else if (line.length > 0) {
        emit({ type: "message", text: line });
      }
    });
    const stderr = createLineDecoder((line) => {
      stderrLines.push(line);
      if (line.trim().length > 0) {
        emit({
          type: "diagnostic",
          level: "warning",
          code: "RUNTIME_STDERR",
          message: line,
        });
      }
    });

    emit({ type: "status", phase: "starting", message: `Starting ${options.command}` });

    const child = spawnRuntime(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    if (child.pid) {
      emit({
        type: "diagnostic",
        level: "info",
        code: "RUNTIME_PROCESS_STARTED",
        message: `Started ${options.command} with PID ${child.pid}`,
        metadata: { pid: child.pid, executablePath: options.command },
      });
    }

    child.stdout.on("data", (chunk: Buffer) => stdout.feed(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.feed(chunk));

    if (options.stdin === undefined) {
      child.stdin.end();
    } else {
      child.stdin.end(options.stdin);
    }

    const requestStop = (status: "cancelled" | "timed_out"): void => {
      if (state.settled || state.requestedTerminal) return;
      state.requestedTerminal = status;
      emit({
        type: "status",
        phase: "stopping",
        message: terminalMessage(status, options.command, null, null, ""),
      });
      void terminateRuntimeProcess(child).then(
        () => undefined,
        (error: unknown) =>
          emit({
            type: "diagnostic",
            level: "error",
            code: "RUNTIME_TREE_TERMINATION_FAILED",
            message: error instanceof Error ? error.message : String(error),
          }),
      );
    };

    const timeout = setTimeout(() => requestStop("timed_out"), options.timeoutMs);
    const abort = (): void => requestStop("cancelled");
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();

    const finish = async (
      code: number | null,
      signal: NodeJS.Signals | null,
      spawnError?: Error,
    ): Promise<void> => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      stdout.flush();
      stderr.flush();

      if (spawnError) {
        emit({
          type: "diagnostic",
          level: "error",
          code: "RUNTIME_SPAWN_FAILED",
          message: spawnError.message,
          retryable: true,
        });
      }

      const status: RuntimeTerminalStatus =
        state.requestedTerminal ?? (spawnError || code !== 0 ? "failed" : "completed");
      const resultText = stdoutLines.join("\n");
      const terminal = emit({
        type: "terminal",
        status,
        exitCode: code,
        signal,
        resultText,
      });
      await eventEmitter.delivered();

      const result = RuntimeExecutionResultSchema.parse({ text: resultText, terminal, events });
      if (status === "completed") {
        resolve(ok(result));

        return;
      }

      resolve(
        err(
          new RuntimeProcessError(
            spawnError?.message ??
              terminalMessage(status, options.command, code, signal, stderrLines.join("\n")),
            result,
          ),
        ),
      );
    };

    child.on("error", (error) => void finish(null, null, error));
    child.on("close", (code, signal) => void finish(code, signal));
  });
