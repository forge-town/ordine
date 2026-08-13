import type { ConnectorRecord, SkillRecord } from "@repo/db-schema";
import { describe, expect, it } from "vitest";
import {
  buildCapabilityHarvestPlan,
  type CapabilityHarvestCandidates,
} from "./capabilityHarvestRepository";

const source = (sourceKey: string, runtime: "claude-code" | "codex" = "claude-code") => ({
  sourceKey,
  source: runtime,
  scope: "global" as const,
  path: `/home/test/.${runtime}/config`,
  nativeName: "filesystem",
  enabled: true,
  lastSeenAt: "2026-08-13T00:00:00.000Z",
});

const candidate = (
  overrides: Partial<CapabilityHarvestCandidates> = {},
): CapabilityHarvestCandidates => ({
  connectors: [
    {
      id: "harvested-connector-signature",
      name: "filesystem",
      config: { transport: "stdio", command: "npx", args: ["server-files"] },
      signature: "signature",
      sources: [source("source-a")],
      encryptedCredentials: {},
    },
  ],
  skills: [
    {
      id: "harvested-skill-review",
      name: "review",
      label: "Review",
      description: "Review code",
      sources: [source("skill-source")],
    },
  ],
  ...overrides,
});

const connectorRow = (overrides: Partial<ConnectorRecord> = {}): ConnectorRecord => ({
  id: "manual-connector",
  name: "My custom name",
  method: "mcp",
  status: "connected",
  scopes: null,
  config: { transport: "stdio", command: "npx", args: ["server-files"] },
  origin: "manual",
  signature: null,
  sources: [],
  encryptedCredentials: {},
  lastSyncAt: new Date("2026-08-01"),
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

const skillRow = (overrides: Partial<SkillRecord> = {}): SkillRecord => ({
  id: "manual-skill",
  name: "review",
  label: "My Review",
  description: "Keep my description",
  category: "manual",
  tags: ["custom"],
  origin: "manual",
  sources: [],
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...overrides,
});

describe("buildCapabilityHarvestPlan", () => {
  it("creates one connector and one skill for new capabilities", () => {
    const plan = buildCapabilityHarvestPlan([], [], candidate());

    expect(plan.connectorCreates).toHaveLength(1);
    expect(plan.connectorCreates[0]).toMatchObject({ origin: "harvested", method: "mcp" });
    expect(plan.skillCreates).toHaveLength(1);
    expect(plan.skillCreates[0]).toMatchObject({ origin: "harvested", tags: ["harvested"] });
  });

  it("matches a manual connector by command identity and preserves manual fields", () => {
    const existing = connectorRow();
    const plan = buildCapabilityHarvestPlan([existing], [], candidate({ skills: [] }));

    expect(plan.connectorCreates).toEqual([]);
    expect(plan.connectorUpdates).toEqual([
      {
        id: existing.id,
        patch: expect.objectContaining({
          signature: "signature",
          sources: [expect.objectContaining({ sourceKey: "source-a" })],
        }),
      },
    ]);
    expect(plan.connectorUpdates[0]?.patch).not.toHaveProperty("name");
    expect(plan.connectorUpdates[0]?.patch).not.toHaveProperty("config");
    expect(plan.connectorUpdates[0]?.patch).not.toHaveProperty("status");
  });

  it("updates a harvested connector when the same source changes command", () => {
    const existing = connectorRow({
      id: "harvested",
      origin: "harvested",
      signature: "old-signature",
      sources: [source("source-a")],
      config: { transport: "stdio", command: "old-command" },
    });
    const plan = buildCapabilityHarvestPlan([existing], [], candidate({ skills: [] }));

    expect(plan.connectorCreates).toEqual([]);
    expect(plan.connectorUpdates[0]).toMatchObject({
      id: "harvested",
      patch: {
        config: { transport: "stdio", command: "npx", args: ["server-files"] },
        signature: "signature",
        status: "needs_setup",
        lastSyncAt: null,
      },
    });
  });

  it("merges a second runtime source into the same connector", () => {
    const existing = connectorRow({
      origin: "harvested",
      signature: "signature",
      sources: [source("source-a")],
    });
    const incoming = candidate({ skills: [] });
    incoming.connectors[0]!.sources = [source("source-b", "codex")];
    const plan = buildCapabilityHarvestPlan([existing], [], incoming);

    expect(plan.connectorCreates).toEqual([]);
    expect(plan.connectorUpdates[0]?.patch.sources).toHaveLength(2);
  });

  it("preserves a harvested connector handshake on an unchanged repeat scan", () => {
    const existing = connectorRow({
      id: "harvested",
      origin: "harvested",
      signature: "signature",
      sources: [source("source-a")],
    });
    const plan = buildCapabilityHarvestPlan([existing], [], candidate({ skills: [] }));

    expect(plan.connectorUpdates[0]?.patch).not.toHaveProperty("config");
    expect(plan.connectorUpdates[0]?.patch).not.toHaveProperty("status");
    expect(plan.connectorUpdates[0]?.patch).not.toHaveProperty("lastSyncAt");
  });

  it("removes stale credentials only for sources that were successfully refreshed", () => {
    const envelope = {
      version: 1 as const,
      algorithm: "aes-256-gcm" as const,
      iv: "iv",
      ciphertext: "ciphertext",
      authTag: "tag",
    };
    const existing = connectorRow({
      origin: "harvested",
      signature: "signature",
      sources: [source("source-a"), source("source-b", "codex")],
      encryptedCredentials: { "source-a": envelope, "source-b": envelope },
    });
    const plan = buildCapabilityHarvestPlan([existing], [], candidate({ skills: [] }));

    expect(plan.connectorUpdates[0]?.patch.encryptedCredentials).toEqual({
      "source-b": envelope,
    });
  });

  it("preserves manual skill content while adding provenance", () => {
    const existing = skillRow();
    const plan = buildCapabilityHarvestPlan([], [existing], candidate({ connectors: [] }));

    expect(plan.skillCreates).toEqual([]);
    expect(plan.skillUpdates[0]?.patch).toEqual({
      sources: [expect.objectContaining({ sourceKey: "skill-source" })],
    });
  });

  it("does nothing for an empty scan and never produces delete operations", () => {
    const plan = buildCapabilityHarvestPlan([connectorRow()], [skillRow()], {
      connectors: [],
      skills: [],
    });

    expect(plan).toEqual({
      connectorCreates: [],
      connectorUpdates: [],
      skillCreates: [],
      skillUpdates: [],
    });
    expect(Object.keys(plan).some((key) => key.toLowerCase().includes("delete"))).toBe(false);
  });
});
