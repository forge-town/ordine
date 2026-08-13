import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { normalize } from "node:path";
import { z } from "zod/v4";
import { CapabilitySourceIdSchema, CapabilitySourceScopeSchema } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { getCapabilityConfigCandidates } from "./capabilityConfigCandidates";
import {
  CapabilityAdapterContextSchema,
  CapabilityCredentialsSchema,
  CapabilityParseDiagnosticSchema,
  ParsedMcpServerSchema,
  type CapabilityAdapterContext,
  type CapabilityConfigCandidate,
  type CapabilityCredentials,
  type CapabilityParseResult,
  type ParsedMcpServer,
} from "./capabilitySchemas";
import { parseClaudeMcpConfig } from "./parseClaudeMcpConfig";
import { parseCodexMcpConfig } from "./parseCodexMcpConfig";
import { parseCursorMcpConfig } from "./parseCursorMcpConfig";
import { parseHermesMcpConfig } from "./parseHermesMcpConfig";
import { parseKimiMcpConfig } from "./parseKimiMcpConfig";
import { parseOpenclawMcpConfig } from "./parseOpenclawMcpConfig";
import { parseOpencodeMcpConfig } from "./parseOpencodeMcpConfig";

export const ScannedMcpServerSchema = ParsedMcpServerSchema.extend({
  sourceKey: z.string().min(1),
  source: CapabilitySourceIdSchema,
  scope: CapabilitySourceScopeSchema,
  path: z.string().min(1),
});
export type ScannedMcpServer = z.infer<typeof ScannedMcpServerSchema>;

export const McpConfigFileScanSchema = z.object({
  source: CapabilitySourceIdSchema,
  scope: CapabilitySourceScopeSchema,
  path: z.string().min(1),
  status: z.enum(["parsed", "missing", "malformed", "unreadable"]),
  serverCount: z.number().int().nonnegative(),
  diagnostics: z.array(CapabilityParseDiagnosticSchema),
});
export type McpConfigFileScan = z.infer<typeof McpConfigFileScanSchema>;

export const McpCapabilityScanResultSchema = z.object({
  servers: z.array(ScannedMcpServerSchema),
  files: z.array(McpConfigFileScanSchema),
});
export type McpCapabilityScanResult = z.infer<typeof McpCapabilityScanResultSchema>;

type ReadTextFile = (path: string) => Promise<string>;

export interface ScanMcpCapabilitiesOptions extends CapabilityAdapterContext {
  readTextFile?: ReadTextFile;
}

const sourceKey = (candidate: CapabilityConfigCandidate, nativeName: string): string =>
  createHash("sha256")
    .update([candidate.source, candidate.scope, normalize(candidate.path), nativeName].join("\0"))
    .digest("hex");

const isMissingFile = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "ENOENT";

const MCP_CONFIG_PARSERS = {
  codex: parseCodexMcpConfig,
  cursor: parseCursorMcpConfig,
  hermes: parseHermesMcpConfig,
  openclaw: parseOpenclawMcpConfig,
  opencode: parseOpencodeMcpConfig,
  "kimi-code": parseKimiMcpConfig,
} as const;

const parseCandidate = (
  raw: string,
  candidate: CapabilityConfigCandidate,
  workspacePath: string | undefined,
) => {
  if (candidate.source === "mastra" || candidate.source === "pi-agent") {
    throw new Error(`MCP config candidate is not applicable to ${candidate.source}`);
  }

  const parsed =
    candidate.source === "claude-code"
      ? parseClaudeMcpConfig(
          raw,
          candidate.selector === "global"
            ? { scope: "global" }
            : {
                scope: "workspace",
                ...(candidate.selector === "project-entry" && workspacePath
                  ? { workspacePath }
                  : {}),
              },
        )
      : MCP_CONFIG_PARSERS[candidate.source](raw);

  return parsed;
};

const resolvedReferenceCredentials = (
  server: ParsedMcpServer,
  env: CapabilityAdapterContext["env"],
): CapabilityCredentials | undefined => {
  const referencedEnv = Object.fromEntries(
    Object.entries(server.credentialReferences?.env ?? {}).flatMap(([target, envName]) => {
      const value = env[envName];

      return value === undefined ? [] : [[target, value]];
    }),
  );
  const referencedHeaders = Object.fromEntries(
    Object.entries(server.credentialReferences?.headers ?? {}).flatMap(([target, envName]) => {
      const value = env[envName];

      return value === undefined ? [] : [[target, value]];
    }),
  );
  const bearerToken = server.credentialReferences?.bearerTokenEnv
    ? env[server.credentialReferences.bearerTokenEnv]
    : undefined;
  const credentials = {
    ...(Object.keys(referencedEnv).length > 0 || server.credentials?.env
      ? { env: { ...referencedEnv, ...server.credentials?.env } }
      : {}),
    ...(Object.keys(referencedHeaders).length > 0 || server.credentials?.headers
      ? {
          headers: {
            ...referencedHeaders,
            ...(bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {}),
            ...server.credentials?.headers,
          },
        }
      : bearerToken
        ? { headers: { Authorization: `Bearer ${bearerToken}` } }
        : {}),
  };

  return Object.keys(credentials).length > 0
    ? CapabilityCredentialsSchema.parse(credentials)
    : undefined;
};

const parsedFile = (
  candidate: CapabilityConfigCandidate,
  parsed: CapabilityParseResult,
  env: CapabilityAdapterContext["env"],
): { servers: ScannedMcpServer[]; file: McpConfigFileScan } => ({
  servers: parsed.servers.map((server) =>
    ScannedMcpServerSchema.parse({
      ...server,
      credentials: resolvedReferenceCredentials(server, env),
      sourceKey: sourceKey(candidate, server.nativeName),
      source: candidate.source,
      scope: candidate.scope,
      path: candidate.path,
    }),
  ),
  file: McpConfigFileScanSchema.parse({
    source: candidate.source,
    scope: candidate.scope,
    path: candidate.path,
    status: "parsed",
    serverCount: parsed.servers.length,
    diagnostics: parsed.diagnostics,
  }),
});

const failedFile = (
  candidate: CapabilityConfigCandidate,
  status: "missing" | "malformed" | "unreadable",
): McpConfigFileScan =>
  McpConfigFileScanSchema.parse({
    source: candidate.source,
    scope: candidate.scope,
    path: candidate.path,
    status,
    serverCount: 0,
    diagnostics: [],
  });

export const scanMcpCapabilities = async (
  input: ScanMcpCapabilitiesOptions,
): Promise<McpCapabilityScanResult> => {
  const context = CapabilityAdapterContextSchema.parse(input);
  const readTextFile = input.readTextFile ?? ((path: string) => readFile(path, "utf8"));
  const candidates = getCapabilityConfigCandidates(context);
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const readResult = await ResultAsync.fromPromise(
        readTextFile(candidate.path),
        (error) => error,
      );
      if (readResult.isErr()) {
        return {
          servers: [],
          file: failedFile(candidate, isMissingFile(readResult.error) ? "missing" : "unreadable"),
        };
      }

      const parsed = parseCandidate(readResult.value, candidate, context.workspacePath);
      if (parsed.isErr()) {
        return { servers: [], file: failedFile(candidate, "malformed") };
      }

      return parsedFile(candidate, parsed.value, context.env);
    }),
  );

  return McpCapabilityScanResultSchema.parse({
    servers: results.flatMap((result) => result.servers),
    files: results.map((result) => result.file),
  });
};
