import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { readdirSync, statSync, type Dirent } from "node:fs";
import { join } from "node:path";
import { err, ok, Result, type Result as NeverthrowResult } from "neverthrow";
import {
  RuntimeExecutionResultSchema,
  type RuntimeEvent,
  type RuntimeExecutionResult,
  type RuntimeTerminalStatus,
} from "@repo/schemas";
import { spawnCommand } from "../spawn/spawnCommand";
import { createJsonLineDecoder } from "./createJsonLineDecoder";
import { mapPiRpcEvent, type PiRpcEventState } from "./mapPiRpcEvent";
import { createRuntimeEventEmitter, type RuntimeEventPayload } from "./runtimeEventEmitter";
import { RuntimeProcessError, type RuntimeSpawn } from "./runRuntimeProcess";

type UnknownRecord = Record<string, unknown>;
type SessionSnapshot = Map<string, { mtimeMs: number; size: number }>;

export type PiRpcImage = { type: "image"; data: string; mimeType: string };

export type RunPiRpcSessionOptions = {
  command: string;
  args: readonly string[];
  cwd: string;
  prompt: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  images?: PiRpcImage[];
  parentSession?: string;
  onEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const readSessionEntries = Result.fromThrowable(
  (directory: string): Dirent[] => readdirSync(directory, { withFileTypes: true }),
  () => [] as Dirent[],
);

const readSessionStat = Result.fromThrowable(
  (path: string) => statSync(path),
  () => null,
);

const piSessionFiles = (cwd: string): Array<{ path: string; mtimeMs: number; size: number }> => {
  const directory = join(cwd, ".pi", "sessions");
  const entries = readSessionEntries(directory);
  if (entries.isErr()) return [];

  return entries.value.flatMap((entry) => {
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) return [];
    const path = join(directory, entry.name);
    const stat = readSessionStat(path);
    if (stat.isErr() || !stat.value) return [];

    return [{ path, mtimeMs: stat.value.mtimeMs, size: stat.value.size }];
  });
};

const snapshotSessions = (cwd: string): SessionSnapshot =>
  new Map(piSessionFiles(cwd).map((file) => [file.path, file]));

const changedSession = (cwd: string, before: SessionSnapshot): string | undefined => {
  const changed = piSessionFiles(cwd).filter((file) => {
    const previous = before.get(file.path);

    return !previous || file.mtimeMs > previous.mtimeMs || file.size !== previous.size;
  });

  return changed.length === 1 ? changed[0]?.path : undefined;
};

const extensionUiResponse = (message: UnknownRecord): UnknownRecord | undefined => {
  const id = message["id"];
  if (typeof id !== "number" && typeof id !== "string") return undefined;
  const method = typeof message["method"] === "string" ? message["method"] : "";
  if (["setStatus", "setWidget", "notify", "setTitle", "set_editor_text"].includes(method)) {
    return undefined;
  }
  if (method === "confirm") return { type: "extension_ui_response", id, confirmed: true };
  const params = asRecord(message["params"]);
  const options = Array.isArray(params?.["options"]) ? params["options"] : [];
  const first = options[0];
  if (typeof first === "string") return { type: "extension_ui_response", id, value: first };
  const firstRecord = asRecord(first);
  const value = firstRecord?.["label"] ?? firstRecord?.["value"];

  return value === undefined
    ? { type: "extension_ui_response", id, cancelled: true }
    : { type: "extension_ui_response", id, value };
};

export const runPiRpcSession = (
  options: RunPiRpcSessionOptions,
  spawnRuntime: RuntimeSpawn = spawnCommand,
): Promise<NeverthrowResult<RuntimeExecutionResult, RuntimeProcessError>> =>
  new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawnRuntime(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const before = snapshotSessions(options.cwd);
    const events: RuntimeEvent[] = [];
    const stderrParts: string[] = [];
    const state: PiRpcEventState = {
      startedAt: Date.now(),
      sawVisibleOutput: false,
      thinking: false,
      textParts: [],
      tools: new Map(),
    };
    const lifecycle = {
      settled: false,
      nextId: 1,
      parentId: null as number | null,
      promptId: null as number | null,
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    const runtimeEvents = createRuntimeEventEmitter({
      runtime: "pi-agent",
      onEvent: options.onEvent,
    });
    const emit = (payload: RuntimeEventPayload): RuntimeEvent => {
      const event = runtimeEvents.emit(payload);
      events.push(event);

      return event;
    };
    const send = (type: string, params: UnknownRecord = {}): number => {
      const id = lifecycle.nextId;
      lifecycle.nextId += 1;
      child.stdin.write(`${JSON.stringify({ id, type, ...params })}\n`);

      return id;
    };

    const flushTools = (): void => {
      for (const [id, tool] of state.tools) {
        if (tool.completed) continue;
        tool.completed = true;
        emit({ type: "tool_update", id, name: tool.name, status: "failed" });
        emit({
          type: "tool_result",
          id,
          output: "Pi session ended before the tool completed",
          isError: true,
        });
      }
    };

    const finish = async (status: RuntimeTerminalStatus, message?: string): Promise<void> => {
      if (lifecycle.settled) return;
      lifecycle.settled = true;
      if (lifecycle.timer) clearTimeout(lifecycle.timer);
      options.signal?.removeEventListener("abort", abort);
      if (state.thinking) {
        state.thinking = false;
        emit({ type: "thinking", phase: "completed" });
      }
      flushTools();
      const sessionId = status === "completed" ? changedSession(options.cwd, before) : undefined;
      if (sessionId) emit({ type: "session", phase: "captured", id: sessionId });
      if (message) {
        emit({
          type: "diagnostic",
          level: status === "completed" ? "info" : "error",
          code: status === "completed" ? "PI_RPC_COMPLETED" : "PI_RPC_FAILED",
          message,
        });
      }
      const text = state.textParts.join("");
      const terminal = emit({
        type: "terminal",
        status,
        exitCode: null,
        signal: null,
        resultText: text,
        sessionId,
      });
      child.stdin.end();
      child.kill("SIGTERM");
      await runtimeEvents.delivered();
      const result = RuntimeExecutionResultSchema.parse({
        text,
        sessionId,
        terminal,
        events,
      });
      resolve(
        status === "completed"
          ? ok(result)
          : err(new RuntimeProcessError(message ?? `Pi RPC session ${status}`, result)),
      );
    };

    const sendPrompt = (): void => {
      lifecycle.promptId = send("prompt", {
        message: options.prompt,
        ...(options.images && options.images.length > 0 ? { images: options.images } : {}),
      });
    };

    const handleMessage = (value: unknown): void => {
      if (lifecycle.settled) return;
      const message = asRecord(value);
      if (!message) return;
      if (message["type"] === "extension_ui_request") {
        const response = extensionUiResponse(message);
        if (response) child.stdin.write(`${JSON.stringify(response)}\n`);

        return;
      }
      if (message["type"] === "response") {
        if (message["id"] === lifecycle.parentId) {
          if (message["success"] === false) {
            void finish("failed", `Pi parent session rejected: ${String(message["error"])}`);

            return;
          }
          sendPrompt();

          return;
        }
        if (message["id"] === lifecycle.promptId && message["success"] === false) {
          void finish("failed", `Pi prompt rejected: ${String(message["error"])}`);
        }

        return;
      }

      const action = mapPiRpcEvent(message, state, emit);
      if (action.type === "failed") {
        void finish("failed", action.message);

        return;
      }
      if (action.type === "end") {
        if (!state.sawVisibleOutput) {
          void finish("failed", "Pi RPC session completed without visible text or tool output");

          return;
        }
        void finish("completed");
      }
    };

    const stream = createJsonLineDecoder({
      onMessage: handleMessage,
      onMalformed: (diagnostic) =>
        void finish("failed", `Malformed Pi RPC frame: ${diagnostic.message}`),
    });
    child.stdout.on("data", (chunk: Buffer) => stream.feed(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrParts.push(chunk.toString("utf8")));
    child.on("error", (error) => void finish("failed", error.message));
    child.on("close", (code) => {
      stream.flush();
      if (!lifecycle.settled) {
        void finish(
          "failed",
          stderrParts.join("").trim() || `Pi RPC process exited before agent_end (${code})`,
        );
      }
    });

    const abort = (): void => {
      send("abort");
      void finish("cancelled", "Pi RPC session cancelled");
    };
    emit({ type: "status", phase: "starting", message: `Starting ${options.command} RPC` });
    lifecycle.timer = setTimeout(
      () => void finish("timed_out", "Pi RPC session timed out"),
      options.timeoutMs,
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();

      return;
    }
    if (options.parentSession) {
      lifecycle.parentId = send("new_session", { parentSession: options.parentSession });
    } else {
      sendPrompt();
    }
  });
