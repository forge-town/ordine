import type { ChildProcessWithoutNullStreams } from "node:child_process";
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
import {
  createJsonEventStreamState,
  handleJsonEventStreamLine,
  type JsonEventStreamKind,
} from "./jsonEventStreamMapper";
import { createRuntimeEventEmitter, type RuntimeEventPayload } from "./runtimeEventEmitter";
import { RuntimeProcessError, type RuntimeSpawn } from "./runRuntimeProcess";
import { terminateRuntimeProcess } from "./terminateRuntimeProcess";

export type RunJsonEventStreamOptions = {
  runtime: AgentRuntime;
  kind: JsonEventStreamKind;
  command: string;
  args: readonly string[];
  cwd: string;
  stdin: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  initialEvents?: readonly RuntimeEventPayload[];
  onEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

export const runJsonEventStream = (
  options: RunJsonEventStreamOptions,
  spawnRuntime: RuntimeSpawn = spawnCommand,
): Promise<Result<RuntimeExecutionResult, RuntimeProcessError>> =>
  new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawnRuntime(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const events: RuntimeEvent[] = [];
    const stderrParts: string[] = [];
    const state = createJsonEventStreamState(options.kind);
    const lifecycle = {
      settled: false,
      requestedStatus: null as "cancelled" | "timed_out" | null,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    const runtimeEvents = createRuntimeEventEmitter({
      runtime: options.runtime,
      onEvent: options.onEvent,
    });
    const emit = (payload: RuntimeEventPayload): RuntimeEvent => {
      const event = runtimeEvents.emit(payload);
      events.push(event);

      return event;
    };
    const stdout = createLineDecoder((line) => {
      handleJsonEventStreamLine(line, state, emit);
      if (state.fatalMessage) {
        void terminateRuntimeProcess(child).then(
          () => finish("failed", null, null, state.fatalMessage),
          (error: unknown) =>
            finish("failed", null, null, error instanceof Error ? error.message : String(error)),
        );
      }
    });
    const stderr = createLineDecoder((line) => {
      stderrParts.push(line);
      if (line.trim()) {
        emit({ type: "diagnostic", level: "warning", code: "RUNTIME_STDERR", message: line });
      }
    });
    const flushOpenTools = (): boolean => {
      const openTools = [...state.tools].filter(([, tool]) => !tool.completed);
      for (const [id, tool] of openTools) {
        tool.completed = true;
        emit({ type: "tool_update", id, name: tool.name, status: "failed" });
        emit({
          type: "tool_result",
          id,
          output: "Structured event stream ended before the tool completed",
          isError: true,
        });
      }

      return openTools.length > 0;
    };

    const finish = async (
      requestedStatus: RuntimeTerminalStatus,
      code: number | null,
      signal: NodeJS.Signals | null,
      message?: string,
    ): Promise<void> => {
      if (lifecycle.settled) return;
      lifecycle.settled = true;
      if (lifecycle.timer) clearTimeout(lifecycle.timer);
      options.signal?.removeEventListener("abort", abort);
      stdout.flush();
      stderr.flush();
      if (state.thinking) {
        state.thinking = false;
        emit({ type: "thinking", phase: "completed" });
      }
      const hadOpenTools = flushOpenTools();
      const status: RuntimeTerminalStatus =
        requestedStatus === "completed" &&
        (state.fatalMessage || code !== 0 || !state.sawVisibleOutput || hadOpenTools)
          ? "failed"
          : requestedStatus;
      const outputDiagnostic = state.sawVisibleOutput
        ? undefined
        : `${options.command} completed without visible structured output`;
      const exitDiagnostic =
        code === 0
          ? undefined
          : stderrParts.join("\n").trim() || `${options.command} exited with code ${code}`;
      const toolDiagnostic = hadOpenTools
        ? `${options.command} exited with unfinished tools`
        : undefined;
      const diagnostic =
        message ?? state.fatalMessage ?? outputDiagnostic ?? exitDiagnostic ?? toolDiagnostic;
      if (diagnostic) {
        emit({
          type: "diagnostic",
          level: status === "completed" ? "info" : "error",
          code: status === "completed" ? "JSON_EVENT_STREAM_COMPLETED" : "JSON_EVENT_STREAM_FAILED",
          message: diagnostic,
        });
      }
      const text = state.textParts.join("");
      const terminal = emit({
        type: "terminal",
        status,
        exitCode: code,
        signal,
        resultText: text,
        sessionId: state.sessionId,
      });
      child.stdin.end();
      await runtimeEvents.delivered();
      const result = RuntimeExecutionResultSchema.parse({
        text,
        sessionId: state.sessionId,
        terminal,
        events,
      });
      resolve(
        status === "completed"
          ? ok(result)
          : err(new RuntimeProcessError(diagnostic ?? `${options.command} ${status}`, result)),
      );
    };

    const requestStop = (status: "cancelled" | "timed_out", message: string): void => {
      if (lifecycle.settled || lifecycle.requestedStatus) return;
      lifecycle.requestedStatus = status;
      emit({ type: "status", phase: "stopping", message });
      void terminateRuntimeProcess(child).then(
        () => finish(status, null, "SIGTERM", message),
        (error: unknown) =>
          finish("failed", null, null, error instanceof Error ? error.message : String(error)),
      );
    };
    const abort = (): void => requestStop("cancelled", `${options.command} was cancelled`);

    emit({ type: "status", phase: "starting", message: `Starting ${options.command}` });
    for (const event of options.initialEvents ?? []) emit(event);
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
    child.on("error", (error) => void finish("failed", null, null, error.message));
    child.on(
      "close",
      (code, signal) => void finish(lifecycle.requestedStatus ?? "completed", code, signal),
    );
    child.stdin.end(options.stdin);
    lifecycle.timer = setTimeout(
      () => requestStop("timed_out", `${options.command} timed out`),
      options.timeoutMs,
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
  });
