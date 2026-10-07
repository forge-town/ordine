import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCapabilityCatalogService } from "../../capabilityCatalog.service";

const connectorsDao = {
  findMany: vi.fn(),
};
const skillsDao = {
  findMany: vi.fn(),
  seedIfEmpty: vi.fn(),
};
const riskOverridesDao = {
  delete: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
};

const dependencies = { connectorsDao, skillsDao, riskOverridesDao };

describe("createCapabilityCatalogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectorsDao.findMany.mockResolvedValue([]);
    skillsDao.findMany.mockResolvedValue([
      {
        id: "skill-1",
        name: "read-repository",
        label: "Read repository",
        description: "Read source files",
        origin: "manual",
        sources: [],
      },
    ]);
    skillsDao.seedIfEmpty.mockResolvedValue(undefined);
    riskOverridesDao.findMany.mockResolvedValue([]);
    riskOverridesDao.delete.mockResolvedValue(undefined);
    riskOverridesDao.upsert.mockResolvedValue({ capabilityId: "builtin:Read" });
  });

  const createService = () =>
    createCapabilityCatalogService({} as never, { dependencies: dependencies as never });

  it("filters the public projection by runtime and kinds", async () => {
    const result = await createService().getMany({
      runtime: "codex",
      kinds: ["skill"],
    });

    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual([
      expect.objectContaining({ id: "skill:skill-1", kind: "skill", reference: "skill-1" }),
    ]);

    const hermesResult = await createService().getMany({
      runtime: "hermes",
      kinds: ["skill"],
    });
    expect(hermesResult._unsafeUnwrap()).toEqual([]);
  });
});
