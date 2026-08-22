import type { AgentRunPermissionMode, RuntimeEvent } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runJsonEventStream } from "../runtime/runJsonEventStream";

export type RunOpencodeOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  resumeSessionId?: string;
  connectorInjection?: McpConnectorInjection;
  onProgress?: (line: string) => Promise<void> | void;
  onTextDelta?: (text: string) => Promise<void> | void;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
  executablePath?: string;
  permissionMode?: AgentRunPermissionMode;
  networkAccess?: boolean;
  supportsPermissionBypass?: boolean;
};

export const OPENCODE_SKIP_PERMISSIONS_FLAG = "--dangerously-skip-permissions";

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const buildOpenCodeMcpConfigContent = (
  injection: McpConnectorInjection | undefined,
): string | undefined => {
  const mcp = Object.fromEntries(
    Object.entries(injection?.mcpServers ?? {}).map(([name, server]) => [
      name,
      "command" in server
        ? {
            type: "local",
            command: [server.command, ...(server.args ?? [])],
            ...(server.env ? { environment: server.env } : {}),
            enabled: true,
          }
        : {
            type: "remote",
            url: server.url,
            ...(server.headers ? { headers: server.headers } : {}),
            enabled: true,
          },
    ]),
  );

  return Object.keys(mcp).length > 0 ? JSON.stringify({ mcp }) : undefined;
};

export const runOpencode = (options: RunOpencodeOptions): ResultAsync<string, Error> => {
  const args = ["run", "--format", "json"];
  if (options.supportsPermissionBypass) args.push(OPENCODE_SKIP_PERMISSIONS_FLAG);
  if (options.resumeSessionId) args.push("-s", options.resumeSessionId);
  if (options.model && options.model !== "default") args.push("-m", options.model);
  const configContent = buildOpenCodeMcpConfigContent(options.connectorInjection);
  const onEvent = async (event: RuntimeEvent): Promise<void> => {
    if (event.type === "text_delta") await options.onTextDelta?.(event.text);
    if (event.type === "status" || event.type === "diagnostic") {
      await options.onProgress?.(
        `[OpenCode] ${event.type === "status" ? (event.message ?? event.phase) : event.message}`,
      );
    }
    await options.onRuntimeEvent?.(event);
  };

  return ResultAsync.fromPromise(
    runJsonEventStream({
      runtime: "opencode",
      kind: "opencode",
      command: options.executablePath ?? process.env.OPENCODE_BIN ?? "opencode",
      args,
      cwd: options.cwd,
      stdin: options.systemPrompt
        ? `${options.systemPrompt}\n\n---\n\n${options.userPrompt}`
        : options.userPrompt,
      timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
      signal: options.signal,
      env: {
        ...process.env,
        ...(configContent ? { OPENCODE_CONFIG_CONTENT: configContent } : {}),
      },
      initialEvents: [
        {
          type: "diagnostic",
          level: "info",
          code: "OPENCODE_EFFECTIVE_PERMISSION_MODE",
          message: options.supportsPermissionBypass
            ? `OpenCode permission mode: ${OPENCODE_SKIP_PERMISSIONS_FLAG} (capability detected)`
            : "OpenCode permission mode: installed CLI default (permission bypass flag not advertised)",
        },
      ],
      onEvent,
    }),
    toError,
  ).andThen((result) => result.map((value) => value.text));
};
