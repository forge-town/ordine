import { describe, expect, it, vi } from "vitest";
import { createCapabilityHarvestService } from "../../capabilityHarvest.service";

describe("createCapabilityHarvestService", () => {
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
