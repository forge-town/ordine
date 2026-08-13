import { err, ok, type Result } from "neverthrow";
import { McpConnectorConfigSchema } from "@repo/schemas";
import {
  CapabilityParseResultSchema,
  ParsedMcpServerSchema,
  type CapabilityParseDiagnostic,
  type CapabilityParseResult,
  type ParsedMcpServer,
} from "./capabilitySchemas";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string") ? value : undefined;

const asStringRecord = (value: unknown): Record<string, string> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (!entries.every(([, entry]) => typeof entry === "string")) return undefined;

  return Object.fromEntries(entries) as Record<string, string>;
};

const ENV_PLACEHOLDER = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/;
const BEARER_PLACEHOLDER = /^Bearer\s+\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/i;

const splitCredentialRecord = (
  values: Record<string, string> | undefined,
  type: "env" | "headers",
) => {
  const credentials: Record<string, string> = {};
  const references: Record<string, string> = {};
  const state = { bearerTokenEnv: undefined as string | undefined };
  for (const [target, value] of Object.entries(values ?? {})) {
    const placeholder = ENV_PLACEHOLDER.exec(value)?.[1];
    const bearerPlaceholder =
      type === "headers" && target.toLowerCase() === "authorization"
        ? BEARER_PLACEHOLDER.exec(value)?.[1]
        : undefined;
    if (bearerPlaceholder) state.bearerTokenEnv = bearerPlaceholder;
    else if (placeholder) references[target] = placeholder;
    else credentials[target] = value;
  }

  return { credentials, references, bearerTokenEnv: state.bearerTokenEnv };
};

const normalizeCommand = (
  raw: Record<string, unknown>,
): { command: string; args?: string[] } | undefined => {
  if (typeof raw.command === "string" && raw.command.trim()) {
    const args = asStringArray(raw.args);

    return { command: raw.command, ...(args ? { args } : {}) };
  }

  const commandParts = asStringArray(raw.command);
  if (!commandParts || commandParts.length === 0 || !commandParts[0]?.trim()) return undefined;

  return {
    command: commandParts[0],
    ...(commandParts.length > 1 ? { args: commandParts.slice(1) } : {}),
  };
};

const credentialReferences = (
  raw: Record<string, unknown>,
  discovered: {
    env?: Record<string, string>;
    headers?: Record<string, string>;
    bearerTokenEnv?: string;
  },
) => {
  const env = asStringArray(raw.env_vars);
  const headerRefs = asStringRecord(raw.env_http_headers);
  const discoveredEnv =
    discovered.env && Object.keys(discovered.env).length > 0 ? discovered.env : undefined;
  const discoveredHeaders =
    discovered.headers && Object.keys(discovered.headers).length > 0
      ? discovered.headers
      : undefined;
  const bearerTokenEnv =
    typeof raw.bearer_token_env_var === "string"
      ? raw.bearer_token_env_var
      : typeof raw.bearerTokenEnvVar === "string"
        ? raw.bearerTokenEnvVar
        : undefined;
  const references = {
    ...((env && env.length > 0) || discoveredEnv
      ? {
          env: {
            ...(env ? Object.fromEntries(env.map((name) => [name, name])) : {}),
            ...discoveredEnv,
          },
        }
      : {}),
    ...(headerRefs || discoveredHeaders
      ? { headers: { ...headerRefs, ...discoveredHeaders } }
      : {}),
    ...(bearerTokenEnv || discovered.bearerTokenEnv
      ? { bearerTokenEnv: bearerTokenEnv ?? discovered.bearerTokenEnv }
      : {}),
  };

  return Object.keys(references).length > 0 ? references : undefined;
};

const normalizeMcpServer = (nativeName: string, value: unknown): Result<ParsedMcpServer, Error> => {
  if (!isRecord(value)) return err(new Error("server entry must be an object"));

  const enabled = value.enabled !== false && value.disabled !== true;
  if (value.transport === "sse" || value.type === "sse") {
    return err(new Error("legacy SSE MCP transport is not supported"));
  }
  const command = normalizeCommand(value);
  const environment = splitCredentialRecord(
    asStringRecord(value.env) ?? asStringRecord(value.environment),
    "env",
  );

  if (command) {
    const refs = credentialReferences(value, { env: environment.references });
    const parsed = McpConnectorConfigSchema.safeParse({
      transport: "stdio",
      ...command,
      ...(typeof value.cwd === "string" && value.cwd.trim()
        ? { cwd: value.cwd }
        : typeof value.workingDirectory === "string" && value.workingDirectory.trim()
          ? { cwd: value.workingDirectory }
          : {}),
    });
    if (!parsed.success) return err(new Error("invalid stdio MCP configuration"));

    return ok(
      ParsedMcpServerSchema.parse({
        nativeName,
        enabled,
        config: parsed.data,
        ...(Object.keys(environment.credentials).length > 0
          ? { credentials: { env: environment.credentials } }
          : {}),
        ...(refs ? { credentialReferences: refs } : {}),
      }),
    );
  }

  if (typeof value.url === "string") {
    const headers = splitCredentialRecord(
      asStringRecord(value.headers) ?? asStringRecord(value.http_headers),
      "headers",
    );
    const refs = credentialReferences(value, {
      headers: headers.references,
      ...(headers.bearerTokenEnv ? { bearerTokenEnv: headers.bearerTokenEnv } : {}),
    });
    const parsed = McpConnectorConfigSchema.safeParse({
      transport: "http",
      url: value.url,
    });
    if (!parsed.success) return err(new Error("invalid HTTP MCP configuration"));

    return ok(
      ParsedMcpServerSchema.parse({
        nativeName,
        enabled,
        config: parsed.data,
        ...(Object.keys(headers.credentials).length > 0
          ? { credentials: { headers: headers.credentials } }
          : {}),
        ...(refs ? { credentialReferences: refs } : {}),
      }),
    );
  }

  return err(new Error("server entry requires command or HTTP(S) url"));
};

export const normalizeMcpServerMap = (value: unknown): CapabilityParseResult => {
  if (value === undefined)
    return CapabilityParseResultSchema.parse({ servers: [], diagnostics: [] });
  if (!isRecord(value)) {
    return CapabilityParseResultSchema.parse({
      servers: [],
      diagnostics: [{ code: "invalid-root", message: "MCP server map must be an object" }],
    });
  }

  const servers: ParsedMcpServer[] = [];
  const diagnostics: CapabilityParseDiagnostic[] = [];
  for (const [nativeName, rawServer] of Object.entries(value)) {
    const normalized = normalizeMcpServer(nativeName, rawServer);
    if (normalized.isOk()) {
      servers.push(normalized.value);
    } else {
      diagnostics.push({
        code: "invalid-server",
        nativeName,
        message: normalized.error.message,
      });
    }
  }

  return CapabilityParseResultSchema.parse({ servers, diagnostics });
};
