import { describe, expect, it, vi } from "vitest";
import { createCapabilityHarvestService } from "./createCapabilityHarvestService";

describe("createCapabilityHarvestService", () => {
  it("scans, prepares, and persists capabilities without exposing credentials in the write", async () => {
    const sync = vi.fn().mockResolvedValue({
      connectorsCreated: 1,
      connectorsUpdated: 0,
      skillsCreated: 0,
      skillsUpdated: 0,
    });
    const scanMcp = vi.fn().mockResolvedValue({
      files: [],
      servers: [
        {
          sourceKey: "source-a",
          source: "claude-code",
          scope: "global",
          path: "/home/test/.claude.json",
          nativeName: "files",
          enabled: true,
          config: {
            transport: "stdio",
            command: "npx",
            args: ["server-files"],
          },
          credentials: { env: { TOKEN: "must-not-reach-repository" } },
        },
      ],
    });
    const scanSkills = vi.fn().mockResolvedValue({ skills: [], roots: [], diagnostics: [] });
    const service = createCapabilityHarvestService({} as never, {
      encryptionSecret: "test-only-capability-secret",
      homeDir: "/home/test",
      env: {},
      scanMcp,
      scanSkills,
      repository: { sync } as never,
      now: () => new Date("2026-08-13T00:00:00.000Z"),
    });

    const result = await service.harvest({ workspacePath: "/work/project" });

    expect(result.isOk()).toBe(true);
    expect(scanMcp).toHaveBeenCalledWith({
      homeDir: "/home/test",
      env: {},
      workspacePath: "/work/project",
    });
    expect(sync).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(sync.mock.calls[0]![0])).not.toContain("must-not-reach-repository");
  });

  it("does not scan or write when the encryption secret is missing", async () => {
    const sync = vi.fn();
    const scanMcp = vi.fn();
    const scanSkills = vi.fn();
    const service = createCapabilityHarvestService({} as never, {
      encryptionSecret: "",
      scanMcp,
      scanSkills,
      repository: { sync } as never,
    });

    const result = await service.harvest({});

    expect(result.isErr()).toBe(true);
    expect(scanMcp).not.toHaveBeenCalled();
    expect(scanSkills).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
  });

  it("coalesces automatic harvests and reuses the completed result", async () => {
    const sync = vi.fn().mockResolvedValue({
      connectorsCreated: 0,
      connectorsUpdated: 0,
      skillsCreated: 0,
      skillsUpdated: 0,
    });
    const scanMcp = vi.fn().mockResolvedValue({ files: [], servers: [] });
    const scanSkills = vi.fn().mockResolvedValue({ skills: [], roots: [], diagnostics: [] });
    const service = createCapabilityHarvestService({} as never, {
      encryptionSecret: "test-only-capability-secret",
      scanMcp,
      scanSkills,
      repository: { sync } as never,
    });

    const [first, second] = await Promise.all([service.harvestOnce({}), service.harvestOnce({})]);
    const third = await service.harvestOnce({});

    expect(first.isOk()).toBe(true);
    expect(second.isOk()).toBe(true);
    expect(third.isOk()).toBe(true);
    expect(scanMcp).toHaveBeenCalledTimes(1);
    expect(scanSkills).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
