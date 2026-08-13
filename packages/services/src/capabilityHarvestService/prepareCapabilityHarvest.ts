import { createHash } from "node:crypto";
import type {
  McpCapabilityScanResult,
  ScannedMcpServer,
  ScannedSkill,
  SkillCapabilityScanResult,
} from "@repo/agent";
import type { CapabilitySource, McpConnectorConfig } from "@repo/schemas";
import type {
  CapabilityHarvestCandidates,
  HarvestConnectorCandidate,
  HarvestSkillCandidate,
} from "@repo/models";
import { err, ok, type Result } from "neverthrow";
import type { CredentialCipher, CredentialCipherError } from "./credentialCipher";

export const createMcpSignature = (config: McpConnectorConfig): string => {
  const identity =
    config.transport === "stdio"
      ? {
          transport: config.transport,
          command: config.command.trim(),
          args: config.args ?? [],
          cwd: config.cwd ?? null,
        }
      : { transport: config.transport, url: config.url.trim() };

  return createHash("sha256").update(JSON.stringify(identity)).digest("hex");
};

const deterministicId = (prefix: string, identity: string): string =>
  `${prefix}-${createHash("sha256").update(identity).digest("hex").slice(0, 20)}`;

const sourceFromMcp = (server: ScannedMcpServer, lastSeenAt: string): CapabilitySource => ({
  sourceKey: server.sourceKey,
  source: server.source,
  scope: server.scope,
  path: server.path,
  nativeName: server.nativeName,
  enabled: server.enabled,
  ...(server.credentialReferences ? { credentialReferences: server.credentialReferences } : {}),
  lastSeenAt,
});

const mergeSource = (sources: CapabilitySource[], source: CapabilitySource): void => {
  const index = sources.findIndex((entry) => entry.sourceKey === source.sourceKey);
  if (index < 0) sources.push(source);
  else sources[index] = source;
};

const effectiveMcpServers = (servers: ScannedMcpServer[]): ScannedMcpServer[] => {
  const scopedServers = new Map<string, ScannedMcpServer>();
  for (const server of servers) {
    scopedServers.set([server.source, server.scope, server.nativeName].join("\0"), server);
  }
  const workspaceNames = new Set(
    [...scopedServers.values()]
      .filter((server) => server.scope === "workspace")
      .map((server) => [server.source, server.nativeName].join("\0")),
  );

  return [...scopedServers.values()].filter(
    (server) =>
      server.scope === "workspace" ||
      !workspaceNames.has([server.source, server.nativeName].join("\0")),
  );
};

const prepareConnectors = (
  scan: McpCapabilityScanResult,
  cipher: CredentialCipher,
  lastSeenAt: string,
): Result<HarvestConnectorCandidate[], CredentialCipherError> => {
  const bySignature = new Map<string, HarvestConnectorCandidate>();

  for (const server of effectiveMcpServers(scan.servers)) {
    const signature = createMcpSignature(server.config);
    const source = sourceFromMcp(server, lastSeenAt);
    const existing = bySignature.get(signature);
    const encrypted = server.credentials
      ? cipher.encrypt(server.sourceKey, server.credentials)
      : ok(undefined);
    if (encrypted.isErr()) return err(encrypted.error);

    if (existing) {
      mergeSource(existing.sources, source);
      if (encrypted.value) existing.encryptedCredentials[server.sourceKey] = encrypted.value;
      continue;
    }

    bySignature.set(signature, {
      id: deterministicId("harvested-connector", signature),
      name: server.nativeName,
      config: server.config,
      signature,
      sources: [source],
      encryptedCredentials: encrypted.value ? { [server.sourceKey]: encrypted.value } : {},
    });
  }

  return ok([...bySignature.values()]);
};

const sourceFromSkill = (
  skill: ScannedSkill,
  source: ScannedSkill["sources"][number],
  lastSeenAt: string,
): CapabilitySource => ({
  sourceKey: source.sourceKey,
  source: source.source,
  scope: source.scope,
  path: skill.path,
  nativeName: skill.name,
  enabled: true,
  lastSeenAt,
});

const prepareSkills = (
  scan: SkillCapabilityScanResult,
  lastSeenAt: string,
): HarvestSkillCandidate[] => {
  const byName = new Map<string, HarvestSkillCandidate>();

  for (const skill of scan.skills) {
    const existing = byName.get(skill.name);
    if (existing) {
      const existingHasWorkspaceSource = existing.sources.some(
        (source) => source.scope === "workspace",
      );
      const incomingHasWorkspaceSource = skill.sources.some(
        (source) => source.scope === "workspace",
      );
      if (incomingHasWorkspaceSource && !existingHasWorkspaceSource) {
        existing.label = skill.label;
        existing.description = skill.description;
      }
      for (const source of skill.sources) {
        mergeSource(existing.sources, sourceFromSkill(skill, source, lastSeenAt));
      }
      continue;
    }

    byName.set(skill.name, {
      id: deterministicId("harvested-skill", skill.name),
      name: skill.name,
      label: skill.label,
      description: skill.description,
      sources: skill.sources.map((source) => sourceFromSkill(skill, source, lastSeenAt)),
    });
  }

  return [...byName.values()];
};

export const prepareCapabilityHarvest = ({
  mcpScan,
  skillScan,
  cipher,
  now,
}: {
  mcpScan: McpCapabilityScanResult;
  skillScan: SkillCapabilityScanResult;
  cipher: CredentialCipher;
  now: Date;
}): Result<CapabilityHarvestCandidates, CredentialCipherError> => {
  const lastSeenAt = now.toISOString();
  const connectors = prepareConnectors(mcpScan, cipher, lastSeenAt);
  if (connectors.isErr()) return err(connectors.error);

  return ok({
    connectors: connectors.value,
    skills: prepareSkills(skillScan, lastSeenAt),
  });
};
