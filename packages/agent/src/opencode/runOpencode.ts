import type { AgentRunPermissionMode, RuntimeEvent } from "@repo/schemas";
import { errAsync, ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runJsonEventStream } from "../runtime/runJsonEventStream";

export type RunOpencodeOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  resumeSessionId?: string;
  connectorInjection?: McpConnectorInjection;
  onProgress?: (line: string) => Promise<void> | void;
  onTextDelta?: (text: string) => Promise<void> | void;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
  executablePath?: string;
  permissionMode?: AgentRunPermissionMode;
  fullAccessConfirmed?: boolean;
  networkAccess?: boolean;
  supportsVariant?: boolean;
  supportsAutoPermissions?: boolean;
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const buildOpenCodeMcpConfig = (
  injection: McpConnectorInjection | undefined,
): Record<string, unknown> =>
  Object.fromEntries(
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

export const buildOpenCodeMcpConfigContent = (
  injection: McpConnectorInjection | undefined,
): string | undefined => {
  const mcp = buildOpenCodeMcpConfig(injection);

  return Object.keys(mcp).length > 0 ? JSON.stringify({ mcp }) : undefined;
};

const READ_ONLY_BASH_PERMISSION = {
  "*": "deny",
  "pwd*": "allow",
  "ls *": "allow",
  "dir *": "allow",
  "find *": "allow",
  "rg *": "allow",
  "grep *": "allow",
  "cat *": "allow",
  "head *": "allow",
  "tail *": "allow",
  "git status*": "allow",
  "git diff*": "allow",
  "git log*": "allow",
} as const;

const DANGEROUS_BASH_DENIES = {
  "git push*": "deny",
  "git commit*": "deny",
  "git clean*": "deny",
  "git reset --hard*": "deny",
  "rm -rf *": "deny",
  "del *": "deny",
  "rmdir *": "deny",
  "Remove-Item *": "deny",
} as const;

export const buildOpenCodePermission = (
  permissionMode: AgentRunPermissionMode,
  networkAccess: boolean,
): Record<string, unknown> => {
  if (permissionMode === "full-access") {
    return {
      "*": "ask",
      ...(networkAccess
        ? {}
        : {
            webfetch: "deny",
            websearch: "deny",
            bash: {
              "*": "ask",
              "curl *": "deny",
              "wget *": "deny",
              "Invoke-WebRequest *": "deny",
            },
          }),
    };
  }

  return {
    "*": "allow",
    edit: permissionMode === "read-only" ? "deny" : "allow",
    external_directory: "deny",
    task: "deny",
    bash:
      permissionMode === "read-only"
        ? READ_ONLY_BASH_PERMISSION
        : {
            "*": "allow",
            ...DANGEROUS_BASH_DENIES,
            ...(networkAccess
              ? {}
              : {
                  "curl *": "deny",
                  "wget *": "deny",
                  "Invoke-WebRequest *": "deny",
                }),
          },
    ...(networkAccess ? {} : { webfetch: "deny", websearch: "deny" }),
  };
};

export const buildOpenCodeRunConfigContent = (
  injection: McpConnectorInjection | undefined,
  permissionMode: AgentRunPermissionMode,
  networkAccess: boolean,
): string => {
  const mcp = buildOpenCodeMcpConfig(injection);

  return JSON.stringify({
    permission: buildOpenCodePermission(permissionMode, networkAccess),
    ...(Object.keys(mcp).length > 0 ? { mcp } : {}),
  });
};

export const runOpencode = (options: RunOpencodeOptions): ResultAsync<string, Error> => {
  const permissionMode = options.permissionMode ?? "workspace-write";
  const networkAccess = options.networkAccess ?? true;
  if (permissionMode === "full-access" && !options.fullAccessConfirmed) {
    return errAsync(new Error("OpenCode full-access requires explicit user confirmation"));
  }
  if (permissionMode === "full-access" && !options.supportsAutoPermissions) {
    return errAsync(new Error("Installed OpenCode CLI does not advertise --auto"));
  }
  if (
    options.reasoningEffort &&
    options.reasoningEffort !== "default" &&
    !options.supportsVariant
  ) {
    return errAsync(new Error("Installed OpenCode CLI does not advertise --variant"));
  }
  if (options.speed && options.speed !== "default" && options.speed !== "standard") {
    return errAsync(new Error("Installed OpenCode CLI does not advertise a speed option"));
  }
  const args = ["run", "--format", "json"];
  if (permissionMode === "full-access") args.push("--auto");
  if (options.resumeSessionId) args.push("-s", options.resumeSessionId);
  if (options.model && options.model !== "default") args.push("-m", options.model);
  if (options.reasoningEffort && options.reasoningEffort !== "default") {
    args.push("--variant", options.reasoningEffort);
  }
  const configContent = buildOpenCodeRunConfigContent(
    options.connectorInjection,
    permissionMode,
    networkAccess,
  );
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
        OPENCODE_CONFIG_CONTENT: configContent,
      },
      initialEvents: [
        {
          type: "diagnostic",
          level: "info",
          code: "OPENCODE_EFFECTIVE_PERMISSION_MODE",
          message: `OpenCode permission mode: ${permissionMode}${permissionMode === "full-access" ? " with --auto" : ""}; external-directory/network restrictions are CLI policy best-effort`,
        },
      ],
      onEvent,
    }),
    toError,
  ).andThen((result) => result.map((value) => value.text));
};
