import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { err, ok, type Result as NeverthrowResult } from "neverthrow";
import {
  RuntimeExecutionResultSchema,
  type AgentRuntime,
  type RuntimeEvent,
  type RuntimeExecutionResult,
  type RuntimeTerminalStatus,
} from "@repo/schemas";
import type { McpServerEntry } from "../mcp";
import { spawnCommand } from "../spawn/spawnCommand";
import { createJsonLineDecoder } from "./createJsonLineDecoder";
import { createRuntimeEventEmitter, type RuntimeEventPayload } from "./runtimeEventEmitter";
import { RuntimeProcessError, type RuntimeSpawn } from "./runRuntimeProcess";

type UnknownRecord = Record<string, unknown>;

type AcpToolState = {
  name: string;
  input?: unknown;
  output?: unknown;
  lastStatus?: "pending" | "in_progress" | "completed" | "failed";
  resultEmitted: boolean;
};

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const asTokenCount = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

const textFromContent = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.length > 0) return value;
  const record = asRecord(value);
  if (record?.["type"] === "text") return asString(record["text"]);
  if (!Array.isArray(value)) return undefined;

  const text = value
    .flatMap((item) => {
      const content = asRecord(item);

      return content?.["type"] === "text" && typeof content["text"] === "string"
        ? [content["text"]]
        : [];
    })
    .join("\n");

  return text.length > 0 ? text : undefined;
};

const encode = (value: unknown): string => `${JSON.stringify(value)}\n`;

const acpMcpServers = (
  servers: Record<string, McpServerEntry> | undefined,
  envFormat: "array" | "map",
) =>
  Object.entries(servers ?? {}).flatMap(([name, server]) =>
    "command" in server
      ? [
          {
            name,
            command: server.command,
            args: server.args ?? [],
            env:
              envFormat === "map"
                ? (server.env ?? {})
                : Object.entries(server.env ?? {}).map(([key, value]) => ({ key, value })),
          },
        ]
      : [],
  );

const normalizeToolStatus = (
  value: unknown,
): "pending" | "in_progress" | "completed" | "failed" => {
  const status =
    asString(value)
      ?.toLowerCase()
      .replaceAll(/[\s_-]+/g, "") ?? "";
  if (["completed", "complete", "success", "succeeded"].includes(status)) {
    return "completed";
  }
  if (["failed", "failure", "error", "cancelled", "canceled"].includes(status)) {
    return "failed";
  }
  if (["pending", "queued"].includes(status)) return "pending";

  return "in_progress";
};

const normalizedPermissionOptions = (value: unknown) =>
  (Array.isArray(value) ? value : []).flatMap((candidate) => {
    const option = asRecord(candidate);
    const id = asString(option?.["optionId"]);
    if (!id) return [];

    return [
      {
        id,
        kind: asString(option?.["kind"]),
        name: asString(option?.["name"]) ?? asString(option?.["label"]),
      },
    ];
  });

const choosePermissionOption = (
  options: ReturnType<typeof normalizedPermissionOptions>,
): string | undefined =>
  options.find((option) => option.id === "approve_for_session")?.id ??
  options.find((option) => option.kind === "allow_always")?.id ??
  options.find((option) => option.kind === "allow_once")?.id;

const normalizeConfigToken = (value: unknown): string =>
  typeof value === "string"
    ? value
        .trim()
        .toLowerCase()
        .replaceAll(/[\s_-]+/g, "")
    : "";

const findModelConfigId = (value: unknown): string | undefined => {
  for (const candidate of Array.isArray(value) ? value : []) {
    const option = asRecord(candidate);
    const id = asString(option?.["id"]);
    if (!option || !id) continue;
    const type = asString(option["type"]);
    if (type && type !== "select") continue;
    const category = normalizeConfigToken(option["category"]);
    const normalizedId = normalizeConfigToken(id);
    const name = normalizeConfigToken(option["name"]);
    if (
      category === "model" ||
      normalizedId === "model" ||
      (!category && (["models", "modelselector"].includes(normalizedId) || name === "model"))
    ) {
      return id;
    }
  }

  return undefined;
};

const artifactPaths = (update: UnknownRecord): string[] => {
  const locations = Array.isArray(update["locations"]) ? update["locations"] : [];
  const fromLocations = locations.flatMap((location) => {
    const value = asRecord(location);
    const path = asString(value?.["path"]) ?? asString(value?.["uri"]);

    return path ? [path] : [];
  });
  const rawInput = asRecord(update["rawInput"]);
  const fromInput =
    asString(rawInput?.["file_path"]) ??
    asString(rawInput?.["filePath"]) ??
    asString(rawInput?.["path"]);

  return [...new Set([...fromLocations, ...(fromInput ? [fromInput] : [])])];
};

export type RunAcpSessionOptions = {
  runtime: AgentRuntime;
  command: string;
  args: readonly string[];
  cwd: string;
  prompt: string;
  model?: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
  mcpServers?: Record<string, McpServerEntry>;
  mcpEnvFormat?: "array" | "map";
  resumeSessionId?: string;
  completePromptOnTurnEnd?: boolean;
  permissionMode?: "auto_approve" | "cancel";
  onEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

export const runAcpSession = (
  options: RunAcpSessionOptions,
  spawnRuntime: RuntimeSpawn = spawnCommand,
): Promise<NeverthrowResult<RuntimeExecutionResult, RuntimeProcessError>> =>
  new Promise((resolve) => {
    const child: ChildProcessWithoutNullStreams = spawnRuntime(options.command, options.args, {
      cwd: options.cwd,
      env: options.env ?? { ...process.env },
      stdio: ["pipe", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const events: RuntimeEvent[] = [];
    const textParts: string[] = [];
    const stderrParts: string[] = [];
    const tools = new Map<string, AcpToolState>();
    const emittedArtifacts = new Set<string>();
    const state = {
      settled: false,
      sessionId: null as string | null,
      durableSessionId: null as string | null,
      expected: "initialize" as "initialize" | "session" | "model" | "prompt",
      promptRequestId: 3,
      sawVisibleOutput: false,
      thinking: false,
      emittedText: "",
      modelConfigId: undefined as string | undefined,
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
    const send = (id: number, method: string, params: unknown): void => {
      child.stdin.write(encode({ jsonrpc: "2.0", id, method, params }));
    };

    const flushOpenTools = (): void => {
      for (const [id, tool] of tools) {
        if (tool.resultEmitted) continue;
        tool.resultEmitted = true;
        emit({
          type: "tool_update",
          id,
          status: "failed",
          name: tool.name,
          input: tool.input,
          output: tool.output,
        });
        emit({
          type: "tool_result",
          id,
          output: tool.output ?? "ACP session ended before a terminal tool update",
          isError: true,
        });
      }
    };

    const finish = async (status: RuntimeTerminalStatus, message?: string): Promise<void> => {
      if (state.settled) return;
      state.settled = true;
      if (state.timer) clearTimeout(state.timer);
      options.signal?.removeEventListener("abort", abort);
      if (state.thinking) {
        state.thinking = false;
        emit({ type: "thinking", phase: "completed" });
      }
      flushOpenTools();
      if (message) {
        emit({
          type: "diagnostic",
          level: status === "completed" ? "info" : "error",
          code: status === "completed" ? "ACP_COMPLETED" : "ACP_SESSION_FAILED",
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
        sessionId: state.durableSessionId ?? undefined,
      });
      child.stdin.end();
      child.kill("SIGTERM");
      await runtimeEvents.delivered();
      const result = RuntimeExecutionResultSchema.parse({
        text,
        sessionId: state.durableSessionId ?? undefined,
        terminal,
        events,
      });
      resolve(
        status === "completed"
          ? ok(result)
          : err(new RuntimeProcessError(message ?? `ACP session ${status}`, result)),
      );
    };

    const complete = (usage?: unknown): void => {
      const value = asRecord(usage);
      if (value) {
        emit({
          type: "usage",
          inputTokens: asTokenCount(value["inputTokens"] ?? value["input_tokens"]),
          outputTokens: asTokenCount(value["outputTokens"] ?? value["output_tokens"]),
          cachedInputTokens: asTokenCount(
            value["cachedInputTokens"] ?? value["cached_input_tokens"],
          ),
          model: options.model,
        });
      }
      if (!state.sawVisibleOutput) {
        void finish("failed", "ACP session completed without visible text or tool output");

        return;
      }
      void finish("completed");
    };

    const sendPrompt = (): void => {
      if (!state.sessionId) {
        void finish("failed", "ACP session did not return a sessionId");

        return;
      }
      state.expected = "prompt";
      send(state.promptRequestId, "session/prompt", {
        sessionId: state.sessionId,
        prompt: [{ type: "text", text: options.prompt }],
      });
      emit({ type: "status", phase: "running", message: "ACP prompt started" });
    };

    const emitToolUpdate = (update: UnknownRecord): void => {
      const id = asString(update["toolCallId"]);
      if (!id) return;
      const existing = tools.get(id);
      const name =
        asString(update["title"]) ??
        asString(update["name"]) ??
        asString(update["kind"]) ??
        existing?.name ??
        "tool";
      const tool = existing ?? { name, resultEmitted: false };
      tool.name = name;
      tool.input = update["rawInput"] ?? tool.input;
      tool.output = update["content"] ?? update["rawOutput"] ?? tool.output;
      tools.set(id, tool);

      if (!existing) {
        state.sawVisibleOutput = true;
        emit({ type: "tool_start", id, name, input: tool.input });
      }

      const status = normalizeToolStatus(update["status"]);
      if (status !== tool.lastStatus) {
        tool.lastStatus = status;
        emit({
          type: "tool_update",
          id,
          status,
          name,
          input: tool.input,
          output: tool.output,
        });
      }
      if ((status === "completed" || status === "failed") && !tool.resultEmitted) {
        tool.resultEmitted = true;
        emit({ type: "tool_result", id, output: tool.output, isError: status === "failed" });
        if (status === "completed" && /\b(edit|write|create|patch|replace|save)\b/i.test(name)) {
          for (const path of artifactPaths(update)) {
            if (emittedArtifacts.has(path)) continue;
            emittedArtifacts.add(path);
            emit({ type: "artifact", path });
          }
        }
      }
    };

    const handleUpdate = (message: UnknownRecord): void => {
      const params = asRecord(message["params"]);
      const update = asRecord(params?.["update"]);
      const kind = asString(update?.["sessionUpdate"]);
      if (!update || !kind) return;

      if (kind === "agent_message_chunk") {
        const text = textFromContent(update["content"] ?? update["text"] ?? update["delta"]);
        if (!text) return;
        const delta = text.startsWith(state.emittedText)
          ? text.slice(state.emittedText.length)
          : text;
        if (!delta) return;
        state.sawVisibleOutput = true;
        state.emittedText += delta;
        textParts.push(delta);
        emit({ type: "text_delta", text: delta });

        return;
      }
      if (kind === "agent_thought_chunk") {
        const text = textFromContent(update["content"] ?? update["text"] ?? update["delta"]);
        if (!text) return;
        if (!state.thinking) {
          state.thinking = true;
          emit({ type: "thinking", phase: "started" });
        }
        emit({ type: "thinking_delta", text });

        return;
      }
      if (kind === "tool_call" || kind === "tool_call_update") {
        emitToolUpdate(update);

        return;
      }
      if (kind === "turn_end" && options.completePromptOnTurnEnd) {
        complete(update["usage"]);

        return;
      }
      if (kind.includes("retry")) {
        const status = normalizeToolStatus(update["status"]);
        emit({
          type: "retry",
          phase: status === "failed" ? "exhausted" : "starting",
          message: textFromContent(update["content"] ?? update["message"]),
        });
        emit({ type: "status", phase: "retrying", message: kind });

        return;
      }
      emit({ type: "status", phase: "running", message: kind });
    };

    const handlePermission = (message: UnknownRecord): void => {
      const id = message["id"];
      if (typeof id !== "string" && typeof id !== "number") {
        void finish("failed", "ACP permission request did not include a JSON-RPC id");

        return;
      }
      const params = asRecord(message["params"]);
      const optionsList = normalizedPermissionOptions(params?.["options"]);
      const selectedOptionId =
        options.permissionMode === "cancel" ? undefined : choosePermissionOption(optionsList);
      const toolCall = asRecord(params?.["toolCall"]);
      emit({
        type: "permission",
        requestId: id,
        toolCallId: asString(toolCall?.["toolCallId"] ?? params?.["toolCallId"]),
        title: asString(toolCall?.["title"] ?? params?.["title"]),
        options: optionsList,
        outcome: selectedOptionId ? "selected" : "cancelled",
        selectedOptionId,
      });
      child.stdin.write(
        encode({
          jsonrpc: "2.0",
          id,
          result: selectedOptionId
            ? { outcome: { outcome: "selected", optionId: selectedOptionId } }
            : { outcome: { outcome: "cancelled" } },
        }),
      );
    };

    const handleMessage = (value: unknown): void => {
      if (state.settled) return;
      const message = asRecord(value);
      if (!message) return;
      if (message["method"] === "session/update") {
        handleUpdate(message);

        return;
      }
      if (message["method"] === "session/request_permission") {
        handlePermission(message);

        return;
      }

      const error = asRecord(message["error"]);
      if (error) {
        void finish("failed", asString(error["message"]) ?? "ACP request failed");

        return;
      }
      const id = Number(message["id"]);
      const result = asRecord(message["result"]);
      if (state.expected === "initialize" && id === 1) {
        state.expected = "session";
        if (options.resumeSessionId) {
          send(2, "session/load", { sessionId: options.resumeSessionId, cwd: options.cwd });
        } else {
          send(2, "session/new", {
            cwd: options.cwd,
            mcpServers: acpMcpServers(options.mcpServers, options.mcpEnvFormat ?? "array"),
          });
        }

        return;
      }
      if (state.expected === "session" && id === 2) {
        state.sessionId = asString(result?.["sessionId"]) ?? options.resumeSessionId ?? null;
        state.durableSessionId =
          asString(result?.["openCodeSessionId"]) ?? options.resumeSessionId ?? state.sessionId;
        state.modelConfigId = findModelConfigId(result?.["configOptions"]);
        if (!state.sessionId || !state.durableSessionId) {
          void finish("failed", "ACP session did not return a sessionId");

          return;
        }
        emit({
          type: "session",
          phase: options.resumeSessionId ? "loaded" : "created",
          id: state.durableSessionId,
        });
        if (options.model && options.model !== "default") {
          state.expected = "model";
          if (state.modelConfigId) {
            send(3, "session/set_config_option", {
              sessionId: state.sessionId,
              configId: state.modelConfigId,
              value: options.model,
            });
          } else {
            send(3, "session/set_model", { sessionId: state.sessionId, modelId: options.model });
          }
          state.promptRequestId = 4;

          return;
        }
        sendPrompt();

        return;
      }
      if (state.expected === "model" && id === 3) {
        sendPrompt();

        return;
      }
      if (state.expected === "prompt" && id === state.promptRequestId) {
        complete(result?.["usage"]);
      }
    };

    const stream = createJsonLineDecoder({
      onMessage: handleMessage,
      onMalformed: (diagnostic) => {
        void finish("failed", `Malformed ACP frame: ${diagnostic.message}`);
      },
    });
    child.stdout.on("data", (chunk: Buffer) => stream.feed(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderrParts.push(chunk.toString("utf8")));
    child.on("error", (error) => void finish("failed", error.message));
    child.on("close", (code) => {
      stream.flush();
      if (!state.settled) {
        void finish(
          "failed",
          stderrParts.join("").trim() || `ACP process exited before terminal response (${code})`,
        );
      }
    });

    const abort = (): void => {
      if (state.sessionId) send(99, "session/cancel", { sessionId: state.sessionId });
      void finish("cancelled", "ACP session cancelled");
    };
    emit({ type: "status", phase: "starting", message: `Starting ${options.command} ACP` });
    state.timer = setTimeout(
      () => void finish("timed_out", "ACP session timed out"),
      options.timeoutMs,
    );
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();

      return;
    }
    send(1, "initialize", {
      protocolVersion: 1,
      clientCapabilities: { terminal: false },
      clientInfo: { name: "ordine", version: "0.0.2" },
    });
  });
