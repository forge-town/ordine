import { logger } from "@repo/logger";
import { err, ok, Result, ResultAsync } from "neverthrow";
import type { McpToolSummary } from "./mcpStdioClient";

export type ListMcpToolsHttpOptions = {
  url: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const PROTOCOL_VERSION = "2025-06-18";

type JsonRpcMessage = {
  id?: number | string;
  result?: { tools?: unknown; nextCursor?: unknown };
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

const parseSseMessages = (body: string): JsonRpcMessage[] =>
  body.split("\n\n").flatMap((event) => {
    const data = event
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .join("\n");
    if (!data || data === "[DONE]") return [];
    const parsed = safeJsonParse(data);

    return parsed.isOk() ? [parsed.value] : [];
  });

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

export const listMcpToolsHttp = async ({
  url,
  headers,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ListMcpToolsHttpOptions): Promise<Result<McpToolSummary[], string>> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const state = { sessionId: undefined as string | undefined };
  const requestId = { value: 1 };

  const postJsonRpc = async (message: unknown): Promise<Result<JsonRpcMessage[], string>> => {
    const responseResult = await ResultAsync.fromPromise(
      fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": PROTOCOL_VERSION,
          ...(state.sessionId ? { "mcp-session-id": state.sessionId } : {}),
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      }),
      (error) => (error instanceof Error ? error.message : String(error)),
    );

    if (responseResult.isErr()) return err(`HTTP request failed: ${responseResult.error}`);
    const response = await responseResult.value;
    if (!response.ok) return err(`HTTP ${response.status}: ${response.statusText}`);

    state.sessionId = response.headers.get("mcp-session-id") ?? state.sessionId;

    return parseResponseMessages(response);
  };

  logger.info({ url }, "listMcpToolsHttp: starting handshake");

  const runHandshake = async (): Promise<Result<McpToolSummary[], string>> => {
    const initializeId = requestId.value;
    requestId.value += 1;
    const initializeMessages = await postJsonRpc({
      jsonrpc: "2.0",
      id: initializeId,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "ordine", version: "0.0.0" },
      },
    });
    if (initializeMessages.isErr()) return err(initializeMessages.error);
    const initialized = selectResponseMessage(initializeMessages.value, initializeId);
    if (initialized.isErr()) return err(initialized.error);
    if (initialized.value.error) {
      return err(`initialize error: ${initialized.value.error.message ?? "unknown"}`);
    }

    const initializedNotification = await postJsonRpc({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    if (initializedNotification.isErr()) return err(initializedNotification.error);

    const tools: McpToolSummary[] = [];
    const seenCursors = new Set<string>();
    const cursor = { value: undefined as string | undefined };

    while (true) {
      const id = requestId.value;
      requestId.value += 1;
      const toolMessages = await postJsonRpc({
        jsonrpc: "2.0",
        id,
        method: "tools/list",
        params: cursor.value ? { cursor: cursor.value } : {},
      });
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

  return runHandshake().finally(() => clearTimeout(timer));
};
