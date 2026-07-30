import { logger } from "@repo/logger";
import { err, ok, Result, ResultAsync } from "neverthrow";
import type { McpToolSummary } from "./mcpStdioClient";

export type ListMcpToolsHttpOptions = {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const SUPPORTED_PROTOCOL_VERSION = "2025-06-18";
const PROTOCOL_HEADER = "MCP-Protocol-Version";
const SESSION_HEADER = "MCP-Session-Id";
const SESSION_EXPIRED = "session expired";

type JsonRpcMessage = {
  id?: number | string;
  result?: { protocolVersion?: unknown; tools?: unknown; nextCursor?: unknown };
  error?: { message?: string };
};

const safeJsonParse = Result.fromThrowable(
  (text: string) => JSON.parse(text) as JsonRpcMessage,
  () => "invalid JSON",
);

const toToolSummaries = (raw: unknown): McpToolSummary[] => {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((tool) => {
    if (typeof tool !== "object" || tool === null) return [];
    const name = (tool as { name?: unknown }).name;
    if (typeof name !== "string" || name.length === 0) return [];
    const description = (tool as { description?: unknown }).description;

    return [{ name, ...(typeof description === "string" ? { description } : {}) }];
  });
};

const normalizeLineEndings = (body: string): string => body.replaceAll(/\r\n?/g, "\n");

const parseSseMessages = (body: string): JsonRpcMessage[] => {
  const messages: JsonRpcMessage[] = [];
  const lines = normalizeLineEndings(body).split("\n");
  const dataLines = { value: [] as string[] };

  const flush = () => {
    const data = dataLines.value.join("\n");
    dataLines.value = [];

    if (!data || data.trim() === "[DONE]") return;
    const parsed = safeJsonParse(data);
    if (parsed.isOk()) messages.push(parsed.value);
  };

  for (const line of lines) {
    if (line === "") {
      flush();

      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.value.push(line.slice("data:".length).replace(/^ /, ""));
    }
  }

  flush();

  return messages;
};

const parseJsonMessages = (body: string): Result<JsonRpcMessage[], string> => {
  const parsed = safeJsonParse(body);
  if (parsed.isErr()) return err("HTTP response is not valid JSON");

  return ok(Array.isArray(parsed.value) ? parsed.value : [parsed.value]);
};

const parseResponseMessages = async (
  response: Response,
): Promise<Result<JsonRpcMessage[], string>> => {
  if (response.status === 202) return ok([]);

  const bodyResult = await ResultAsync.fromPromise(response.text(), (error) =>
    error instanceof Error ? error.message : String(error),
  );
  if (bodyResult.isErr()) return err(`HTTP response body read failed: ${bodyResult.error}`);

  const body = bodyResult.value;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/event-stream")) return ok(parseSseMessages(body));

  return parseJsonMessages(body);
};

const selectResponseMessage = (
  messages: JsonRpcMessage[],
  id: number,
): Result<JsonRpcMessage, string> => {
  const msg = messages.find((message) => message.id === id);
  if (!msg) return err(`HTTP response missing JSON-RPC id ${id}`);

  return ok(msg);
};

type PostJsonRpcOptions = {
  protocolVersion?: string;
  allowSessionRecovery?: boolean;
};

export const listMcpToolsHttp = async ({
  url,
  headers,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ListMcpToolsHttpOptions): Promise<Result<McpToolSummary[], string>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const state = {
    sessionId: undefined as string | undefined,
    protocolVersion: undefined as string | undefined,
  };

  logger.info({ url }, "listMcpToolsHttp: starting handshake");

  const cleanupSession = async () => {
    const sessionId = state.sessionId;
    if (!sessionId) return;

    state.sessionId = undefined;
    const responseResult = await ResultAsync.fromPromise(
      fetch(url, {
        method: "DELETE",
        headers: {
          ...headers,
          ...(state.protocolVersion ? { [PROTOCOL_HEADER]: state.protocolVersion } : {}),
          [SESSION_HEADER]: sessionId,
        },
      }),
      (error) => (error instanceof Error ? error.message : String(error)),
    );
    if (responseResult.isErr()) return;

    const response = await responseResult.value;
    if (response.status === 405) return;
  };

  const postJsonRpc = async (
    message: unknown,
    { protocolVersion, allowSessionRecovery = true }: PostJsonRpcOptions = {},
  ): Promise<Result<JsonRpcMessage[], string>> => {
    const responseResult = await ResultAsync.fromPromise(
      fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          ...(protocolVersion ? { [PROTOCOL_HEADER]: protocolVersion } : {}),
          ...(state.sessionId ? { [SESSION_HEADER]: state.sessionId } : {}),
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      }),
      (error) => (error instanceof Error ? error.message : String(error)),
    );

    if (responseResult.isErr()) return err(`HTTP request failed: ${responseResult.error}`);
    const response = await responseResult.value;
    if (response.status === 404 && state.sessionId && allowSessionRecovery) {
      state.sessionId = undefined;
      state.protocolVersion = undefined;

      return err(SESSION_EXPIRED);
    }
    if (!response.ok) return err(`HTTP ${response.status}: ${response.statusText}`);

    const sessionId = response.headers.get(SESSION_HEADER);
    if (sessionId) state.sessionId = sessionId;

    return parseResponseMessages(response);
  };

  const runHandshakeOnce = async (): Promise<Result<McpToolSummary[], string>> => {
    state.protocolVersion = undefined;

    const initializeId = 1;
    const initializeMessages = await postJsonRpc(
      {
        jsonrpc: "2.0",
        id: initializeId,
        method: "initialize",
        params: {
          protocolVersion: SUPPORTED_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "ordine", version: "0.0.0" },
        },
      },
      { allowSessionRecovery: false },
    );
    if (initializeMessages.isErr()) return err(initializeMessages.error);

    const initializeResponse = selectResponseMessage(initializeMessages.value, initializeId);
    if (initializeResponse.isErr()) return err(initializeResponse.error);
    if (initializeResponse.value.error) {
      return err(`initialize error: ${initializeResponse.value.error.message ?? "unknown"}`);
    }

    const negotiatedVersion = initializeResponse.value.result?.protocolVersion;
    if (typeof negotiatedVersion !== "string" || negotiatedVersion.length === 0) {
      return err("initialize result missing protocolVersion");
    }
    state.protocolVersion = negotiatedVersion;
    if (negotiatedVersion !== SUPPORTED_PROTOCOL_VERSION) {
      return err(`unsupported MCP protocol version: ${negotiatedVersion}`);
    }

    const initializedMessages = await postJsonRpc(
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
      { protocolVersion: negotiatedVersion },
    );
    if (initializedMessages.isErr()) return err(initializedMessages.error);

    const tools: McpToolSummary[] = [];
    const seenCursors = new Set<string>();
    const cursor = { value: undefined as string | undefined };
    const requestId = { value: 2 };

    while (true) {
      const id = requestId.value;
      requestId.value += 1;
      const toolMessages = await postJsonRpc(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/list",
          params: cursor.value ? { cursor: cursor.value } : {},
        },
        { protocolVersion: negotiatedVersion },
      );
      if (toolMessages.isErr()) return err(toolMessages.error);

      const toolResponse = selectResponseMessage(toolMessages.value, id);
      if (toolResponse.isErr()) return err(toolResponse.error);
      if (toolResponse.value.error) {
        return err(`tools/list error: ${toolResponse.value.error.message ?? "unknown"}`);
      }

      const toolsRaw = toolResponse.value.result?.tools;
      if (!Array.isArray(toolsRaw)) return err("tools/list result missing a 'tools' array");
      tools.push(...toToolSummaries(toolsRaw));

      const nextCursor = toolResponse.value.result?.nextCursor;
      if (typeof nextCursor !== "string" || nextCursor.length === 0) return ok(tools);
      if (seenCursors.has(nextCursor)) {
        return err(`tools/list pagination cursor repeated: ${nextCursor}`);
      }
      seenCursors.add(nextCursor);
      cursor.value = nextCursor;
    }
  };

  const runHandshakeWithRetry = async (
    retriesRemaining: number,
  ): Promise<Result<McpToolSummary[], string>> => {
    const result = await runHandshakeOnce();
    if (result.isOk()) return result;
    if (result.error !== SESSION_EXPIRED || retriesRemaining === 0) return err(result.error);

    return runHandshakeWithRetry(retriesRemaining - 1);
  };

  const result = await runHandshakeWithRetry(1);
  clearTimeout(timer);
  await cleanupSession();

  return result;
};
