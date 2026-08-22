import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { err, ok, Result, ResultAsync, type Result as NeverthrowResult } from "neverthrow";
import {
  RuntimeExecutionResultSchema,
  type RuntimeEvent,
  type RuntimeExecutionResult,
  type RuntimeTerminalStatus,
} from "@repo/schemas";
import type { McpConnectorInjection } from "../mcp";
import { spawnCommand } from "../spawn/spawnCommand";
import { createJsonLineDecoder } from "../runtime/createJsonLineDecoder";
import { createRuntimeEventEmitter } from "../runtime/runtimeEventEmitter";
import { RuntimeProcessError, type RuntimeSpawn } from "../runtime/runRuntimeProcess";

type UnknownRecord = Record<string, unknown>;
const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;
const asTokenCount = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const encode = (value: unknown): string => `${JSON.stringify(value)}\n`;
const parseJson = Result.fromThrowable(JSON.parse, () => undefined);

const modelSelection = (
  value: string | undefined,
): NeverthrowResult<{ provider: string; id: string } | undefined, Error> => {
  const normalized = value?.trim();
  if (!normalized || normalized === "default") return ok(undefined);
  const separator = normalized.indexOf("/");
  if (separator <= 0 || separator === normalized.length - 1) {
    return err(new Error("DeepSeek Harness model must use provider/model format"));
  }

  return ok({
    provider: normalized.slice(0, separator),
    id: normalized.slice(separator + 1),
  });
};

const toolInput = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const parsed = parseJson(value);

  return parsed.isOk() && asRecord(parsed.value) ? parsed.value : { raw: value };
};

export type RunDeepSeekHarnessOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  connectorInjection?: McpConnectorInjection;
  resumeSessionId?: string;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

export const runDeepSeekHarnessSession = (
  options: RunDeepSeekHarnessOptions,
  spawnRuntime: RuntimeSpawn = spawnCommand,
): Promise<NeverthrowResult<RuntimeExecutionResult, RuntimeProcessError>> =>
  new Promise((resolve) => {
    const command = process.env.DSH_BIN ?? "dsh";
    const profile = process.env.ORDINE_DSH_PROFILE ?? "ordine";
    const child: ChildProcessWithoutNullStreams = spawnRuntime(
      command,
      ["--profile", profile, "--stdio"],
      {
        cwd: options.cwd,
        env: { ...process.env },
        stdio: ["pipe", "pipe", "pipe"],
        detached: process.platform !== "win32",
      },
    );
    const requestId = crypto.randomUUID();
    const events: RuntimeEvent[] = [];
    const textParts: string[] = [];
    const stderrParts: string[] = [];
    const state = {
      settled: false,
      ready: false,
      sessionId: null as string | null,
      sawVisibleOutput: false,
      thinking: false,
      tools: new Map<string, { name: string; completed: boolean }>(),
    };
    const runtimeEvents = createRuntimeEventEmitter({
      runtime: "deepseek-harness",
      onEvent: options.onRuntimeEvent,
    });
    const emit = (payload: Parameters<typeof runtimeEvents.emit>[0]): RuntimeEvent => {
      const event = runtimeEvents.emit(payload);
      events.push(event);

      return event;
    };

    const finish = async (status: RuntimeTerminalStatus, message?: string): Promise<void> => {
      if (state.settled) return;
      state.settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", abort);
      if (state.thinking) {
        state.thinking = false;
        emit({ type: "thinking", phase: "completed" });
      }
      for (const [id, tool] of state.tools) {
        if (tool.completed) continue;
        tool.completed = true;
        emit({ type: "tool_update", id, name: tool.name, status: "failed" });
        emit({
          type: "tool_result",
          id,
          output: "DeepSeek Harness ended before the tool completed",
          isError: true,
        });
      }
      if (message) {
        emit({
          type: "diagnostic",
          level: status === "completed" ? "info" : "error",
          code: status === "completed" ? "DSH_COMPLETED" : "DSH_PROFILE_FAILED",
          message,
        });
      }
      const text = textParts.join("");
      const terminal = emit({
        type: "terminal",
        status,
        exitCode: null,
        signal: null,
        resultText: text,
        sessionId: state.sessionId ?? undefined,
      });
      child.stdin.end();
      child.kill("SIGTERM");
      await runtimeEvents.delivered();
      const result = RuntimeExecutionResultSchema.parse({
        text,
        sessionId: state.sessionId ?? undefined,
        terminal,
        events,
      });
      resolve(
        status === "completed"
          ? ok(result)
          : err(new RuntimeProcessError(message ?? `DeepSeek Harness ${status}`, result)),
      );
    };

    const handleFrame = (value: unknown): void => {
      if (state.settled) return;
      const frame = asRecord(value);
      if (!frame || frame["v"] !== 1) {
        void finish("failed", "DeepSeek Harness emitted an incompatible protocol frame");

        return;
      }
      const type = asString(frame["type"]);
      if (type === "ready") {
        if (state.ready) {
          void finish("failed", "DeepSeek Harness emitted more than one ready frame");

          return;
        }
        if (frame["protocol_version"] !== 1) {
          void finish("failed", "DeepSeek Harness profile protocol version is not supported");

          return;
        }
        const selectedModel = modelSelection(options.model);
        if (selectedModel.isErr()) {
          void finish("failed", selectedModel.error.message);

          return;
        }
        state.ready = true;
        child.stdin.write(
          encode({
            v: 1,
            type: "execute",
            request_id: requestId,
            cwd: options.cwd,
            prompt: options.systemPrompt
              ? `${options.systemPrompt}\n\n${options.userPrompt}`
              : options.userPrompt,
            ...(options.resumeSessionId ? { resume_session_id: options.resumeSessionId } : {}),
            ...(selectedModel.value ? { model: selectedModel.value } : {}),
            mcp_servers: Object.entries(options.connectorInjection?.mcpServers ?? {}).map(
              ([name, server]) => ({ name, ...server }),
            ),
          }),
        );
        emit({ type: "status", phase: "running", message: "DeepSeek Harness ready" });

        return;
      }
      if (type === "protocol_error") {
        void finish("failed", asString(frame["message"]) ?? "DeepSeek Harness protocol error");

        return;
      }
      if (frame["request_id"] !== requestId) return;
      if (type === "session") {
        const sessionId = asString(frame["session_id"]);
        if (!sessionId || state.sessionId) {
          void finish("failed", "DeepSeek Harness emitted an invalid or duplicate session frame");

          return;
        }
        state.sessionId = sessionId;
        emit({
          type: "session",
          phase: options.resumeSessionId ? "loaded" : "created",
          id: sessionId,
        });
        emit({ type: "status", phase: "streaming", message: "DeepSeek Harness streaming" });

        return;
      }
      const requiresSession = new Set(["text", "thinking", "tool_call", "tool_result", "usage"]);
      if (type && requiresSession.has(type) && !state.sessionId) {
        void finish("failed", `DeepSeek Harness emitted ${type} before establishing a session`);

        return;
      }
      if (type === "text" && typeof frame["content"] === "string") {
        state.sawVisibleOutput = true;
        textParts.push(frame["content"]);
        emit({ type: "text_delta", text: frame["content"] });

        return;
      }
      if (type === "thinking" && typeof frame["content"] === "string") {
        if (!state.thinking) {
          state.thinking = true;
          emit({ type: "thinking", phase: "started" });
        }
        emit({ type: "thinking_delta", text: frame["content"] });

        return;
      }
      if (type === "tool_call") {
        const callId = asString(frame["call_id"]);
        const name = asString(frame["name"]);
        if (!callId || !name) {
          void finish("failed", "DeepSeek Harness emitted an invalid tool_call frame");

          return;
        }
        state.sawVisibleOutput = true;
        state.tools.set(callId, { name, completed: false });
        emit({
          type: "tool_start",
          id: callId,
          name,
          input: toolInput(frame["arguments"]),
        });
        emit({ type: "tool_update", id: callId, name, status: "in_progress" });

        return;
      }
      if (type === "tool_result") {
        const callId = asString(frame["call_id"]);
        if (!callId) {
          void finish("failed", "DeepSeek Harness emitted an invalid tool_result frame");

          return;
        }
        const tool = state.tools.get(callId);
        const name = asString(frame["name"]) ?? tool?.name ?? "tool";
        const isError = frame["is_error"] === true;
        if (!tool) {
          state.sawVisibleOutput = true;
          state.tools.set(callId, { name, completed: false });
          emit({ type: "tool_start", id: callId, name });
        }
        const activeTool = state.tools.get(callId);
        if (activeTool) activeTool.completed = true;
        emit({
          type: "tool_update",
          id: callId,
          name,
          status: isError ? "failed" : "completed",
          output: frame["output"],
        });
        emit({
          type: "tool_result",
          id: callId,
          output: frame["output"],
          isError,
        });

        return;
      }
      if (type === "usage") {
        emit({
          type: "usage",
          inputTokens: asTokenCount(frame["input_tokens"]),
          outputTokens: asTokenCount(frame["output_tokens"]),
          cachedInputTokens: asTokenCount(frame["cache_read_tokens"]),
          model: asString(frame["model"]) ?? options.model,
        });

        return;
      }
      if (type === "result") {
        const resultStatus = asString(frame["status"]);
        if (!state.sessionId && resultStatus === "completed") {
          void finish("failed", "DeepSeek Harness completed without a session frame");

          return;
        }
        if (state.sessionId && frame["session_id"] !== state.sessionId) {
          void finish("failed", "DeepSeek Harness terminal result changed the session id");

          return;
        }
        if (textParts.length === 0 && typeof frame["output"] === "string") {
          state.sawVisibleOutput = frame["output"].length > 0 || state.sawVisibleOutput;
          textParts.push(frame["output"]);
          emit({ type: "message", text: frame["output"] });
        }
        if (frame["resume_rejected"] === true) {
          emit({
            type: "diagnostic",
            level: "warning",
            code: "DSH_RESUME_REJECTED",
            message: "DeepSeek Harness rejected the previous session and started a new one",
          });
        }
        if (resultStatus === "completed" && !state.sawVisibleOutput) {
          void finish("failed", "DeepSeek Harness completed without visible text or tool output");

          return;
        }
        void finish(
          resultStatus === "completed"
            ? "completed"
            : resultStatus === "cancelled"
              ? "cancelled"
              : "failed",
          asString(asRecord(frame["error"])?.["message"]),
        );
      }
    };

    const stream = createJsonLineDecoder({
      onMessage: handleFrame,
      onMalformed: (diagnostic) =>
        void finish("failed", `Malformed DeepSeek Harness frame: ${diagnostic.message}`),
    });
    child.stdout.on("data", (chunk: Buffer) => stream.feed(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrParts.push(chunk.toString("utf8")));
    child.on("error", (error) => void finish("failed", error.message));
    child.on("close", (code) => {
      stream.flush();
      if (!state.settled) {
        void finish(
          "failed",
          stderrParts.join("").trim() ||
            `DeepSeek Harness exited before a terminal result (${code}); ready=${state.ready}`,
        );
      }
    });

    const abort = (): void => {
      child.stdin.write(encode({ v: 1, type: "cancel", request_id: requestId }));
      void finish("cancelled", "DeepSeek Harness run cancelled");
    };
    emit({ type: "status", phase: "starting", message: `Starting dsh profile ${profile}` });
    const timer = setTimeout(
      () => void finish("timed_out", "DeepSeek Harness run timed out"),
      options.timeoutMs ?? 10 * 60 * 1000,
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) abort();
  });

export const runDeepSeekHarness = (
  options: RunDeepSeekHarnessOptions,
): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(runDeepSeekHarnessSession(options), (error) =>
    error instanceof Error ? error : new Error(String(error)),
  ).andThen((result) => result.map((value) => value.text));
