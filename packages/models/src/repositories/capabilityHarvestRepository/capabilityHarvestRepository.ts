import type { ConnectorRecord, SkillRecord } from "@repo/db-schema";
import {
  isMcpConnectorConfig,
  type CapabilitySource,
  type ConnectorConfig,
  type EncryptedCredentialMap,
} from "@repo/schemas";
import { createConnectorsDao } from "../../daos/connectorsDao";
import { createSkillsDao } from "../../daos/skillsDao";
import type { DbConnection } from "../../types";

export interface HarvestConnectorCandidate {
  id: string;
  name: string;
  config: ConnectorConfig;
  signature: string;
  sources: CapabilitySource[];
  encryptedCredentials: EncryptedCredentialMap;
}

export interface HarvestSkillCandidate {
  id: string;
  name: string;
  label: string;
  description: string;
  sources: CapabilitySource[];
}

export interface CapabilityHarvestCandidates {
  connectors: HarvestConnectorCandidate[];
  skills: HarvestSkillCandidate[];
}

export interface CapabilityHarvestSummary {
  connectorsCreated: number;
  connectorsUpdated: number;
  skillsCreated: number;
  skillsUpdated: number;
}

type ConnectorCreate = Parameters<ReturnType<typeof createConnectorsDao>["create"]>[0];
type ConnectorPatch = Parameters<ReturnType<typeof createConnectorsDao>["update"]>[1];
type SkillCreate = Parameters<ReturnType<typeof createSkillsDao>["create"]>[0];
type SkillPatch = Parameters<ReturnType<typeof createSkillsDao>["update"]>[1];

export interface CapabilityHarvestPlan {
  connectorCreates: ConnectorCreate[];
  connectorUpdates: Array<{ id: string; patch: ConnectorPatch }>;
  skillCreates: SkillCreate[];
  skillUpdates: Array<{ id: string; patch: SkillPatch }>;
}

const mergeSources = (
  current: CapabilitySource[],
  incoming: CapabilitySource[],
): CapabilitySource[] => {
  const merged = new Map(current.map((source) => [source.sourceKey, source]));
  for (const source of incoming) merged.set(source.sourceKey, source);

  return [...merged.values()];
};

const hasSharedSource = (existing: CapabilitySource[], incoming: CapabilitySource[]): boolean => {
  const keys = new Set(existing.map((source) => source.sourceKey));

  return incoming.some((source) => keys.has(source.sourceKey));
};

const replaceSourceCredentials = (
  current: EncryptedCredentialMap,
  incoming: EncryptedCredentialMap,
  sources: CapabilitySource[],
): EncryptedCredentialMap => {
  const refreshedSourceKeys = new Set(sources.map((source) => source.sourceKey));
  const retained = Object.fromEntries(
    Object.entries(current).filter(([sourceKey]) => !refreshedSourceKeys.has(sourceKey)),
  );

  return { ...retained, ...incoming };
};

const sameMcpIdentity = (left: ConnectorConfig, right: ConnectorConfig): boolean => {
  if (!isMcpConnectorConfig(left) || !isMcpConnectorConfig(right)) return false;
  if (left.transport !== right.transport) return false;

  return left.transport === "stdio" && right.transport === "stdio"
    ? left.command === right.command &&
        left.cwd === right.cwd &&
        JSON.stringify(left.args ?? []) === JSON.stringify(right.args ?? [])
    : left.transport === "http" && right.transport === "http" && left.url === right.url;
};

const connectorMatch = (
  existing: ConnectorRecord[],
  candidate: HarvestConnectorCandidate,
): ConnectorRecord | undefined =>
  existing.find((row) => row.signature === candidate.signature) ??
  existing.find((row) => row.method === "mcp" && sameMcpIdentity(row.config, candidate.config)) ??
  existing.find((row) => hasSharedSource(row.sources, candidate.sources));

const skillMatch = (
  existing: SkillRecord[],
  candidate: HarvestSkillCandidate,
): SkillRecord | undefined =>
  existing.find((row) => row.name === candidate.name) ??
  existing.find((row) => hasSharedSource(row.sources, candidate.sources));

export const buildCapabilityHarvestPlan = (
  existingConnectors: ConnectorRecord[],
  existingSkills: SkillRecord[],
  candidates: CapabilityHarvestCandidates,
): CapabilityHarvestPlan => {
  const connectorCreates: ConnectorCreate[] = [];
  const connectorUpdates: CapabilityHarvestPlan["connectorUpdates"] = [];
  const skillCreates: SkillCreate[] = [];
  const skillUpdates: CapabilityHarvestPlan["skillUpdates"] = [];
  const connectorPool = [...existingConnectors];
  const skillPool = [...existingSkills];

  for (const candidate of candidates.connectors) {
    const existing = connectorMatch(connectorPool, candidate);
    if (!existing) {
      const created: ConnectorCreate = {
        id: candidate.id,
        name: candidate.name,
        method: "mcp",
        status: "needs_setup",
        scopes: null,
        config: candidate.config,
        origin: "harvested",
        signature: candidate.signature,
        sources: candidate.sources,
        encryptedCredentials: candidate.encryptedCredentials,
      };
      connectorCreates.push(created);
      connectorPool.push({
        id: candidate.id,
        name: candidate.name,
        method: "mcp",
        status: "needs_setup",
        scopes: null,
        config: candidate.config,
        origin: "harvested",
        signature: candidate.signature,
        sources: candidate.sources,
        encryptedCredentials: candidate.encryptedCredentials,
        lastSyncAt: null,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
      continue;
    }

    const sharedSource = hasSharedSource(existing.sources, candidate.sources);
    const manualWins = existing.origin === "manual";
    const harvestedConfigChanged =
      !manualWins && sharedSource && existing.signature !== candidate.signature;
    connectorUpdates.push({
      id: existing.id,
      patch: {
        ...(harvestedConfigChanged
          ? {
              name: candidate.name,
              config: candidate.config,
              signature: candidate.signature,
              status: "needs_setup" as const,
              lastSyncAt: null,
            }
          : existing.signature === null
            ? { signature: candidate.signature }
            : {}),
        sources: mergeSources(existing.sources, candidate.sources),
        encryptedCredentials: replaceSourceCredentials(
          existing.encryptedCredentials,
          candidate.encryptedCredentials,
          candidate.sources,
        ),
      },
    });
  }

  for (const candidate of candidates.skills) {
    const existing = skillMatch(skillPool, candidate);
    if (!existing) {
      const created: SkillCreate = {
        id: candidate.id,
        name: candidate.name,
        label: candidate.label,
        description: candidate.description,
        category: "imported",
        tags: ["harvested"],
        origin: "harvested",
        sources: candidate.sources,
      };
      skillCreates.push(created);
      skillPool.push({
        id: candidate.id,
        name: candidate.name,
        label: candidate.label,
        description: candidate.description,
        category: "imported",
        tags: ["harvested"],
        origin: "harvested",
        sources: candidate.sources,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      });
      continue;
    }

    const manualWins = existing.origin === "manual";
    skillUpdates.push({
      id: existing.id,
      patch: {
        ...(manualWins
          ? {}
          : {
              name: candidate.name,
              label: candidate.label,
              description: candidate.description,
            }),
        sources: mergeSources(existing.sources, candidate.sources),
      },
    });
  }

  return { connectorCreates, connectorUpdates, skillCreates, skillUpdates };
};

export class CapabilityHarvestRepository {
  constructor(readonly db: DbConnection) {}

  async sync(candidates: CapabilityHarvestCandidates): Promise<CapabilityHarvestSummary> {
    return this.db.transaction(async (tx) => {
      const connectorsDao = createConnectorsDao(tx);
      const skillsDao = createSkillsDao(tx);
      // Harvesting can run before the Skills page performs its lazy seed.
      // Seed first so imported skills never suppress the built-in catalog.
      await skillsDao.seedIfEmpty();
      const [existingConnectors, existingSkills] = await Promise.all([
        connectorsDao.findMany(),
        skillsDao.findMany(),
      ]);
      const plan = buildCapabilityHarvestPlan(existingConnectors, existingSkills, candidates);

      for (const connector of plan.connectorCreates) await connectorsDao.create(connector);
      for (const update of plan.connectorUpdates) {
        await connectorsDao.update(update.id, update.patch);
      }
      for (const skill of plan.skillCreates) await skillsDao.create(skill);
      for (const update of plan.skillUpdates) await skillsDao.update(update.id, update.patch);

      return {
        connectorsCreated: plan.connectorCreates.length,
        connectorsUpdated: plan.connectorUpdates.length,
        skillsCreated: plan.skillCreates.length,
        skillsUpdated: plan.skillUpdates.length,
      };
    });
  }
}

export const createCapabilityHarvestRepository = (db: DbConnection) =>
  new CapabilityHarvestRepository(db);
