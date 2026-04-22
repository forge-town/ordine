import { describe, it, expect, vi } from "vitest";

const mockDao = {
  get: vi.fn().mockResolvedValue({ defaultApiKey: "key", defaultModel: "gpt-4" }),
  update: vi.fn().mockResolvedValue({ defaultApiKey: "new-key" }),
};

vi.mock("@repo/models", () => ({
  createSettingsDao: () => mockDao,
}));

import { createSettingsService } from "./createSettingsService";
import type { DbConnection } from "@repo/models";

// @ts-expect-error -- DAO is mocked, db parameter unused at runtime
const mockDb: DbConnection = {};

describe("createSettingsService", () => {
  it("get delegates to dao.get", async () => {
    const svc = createSettingsService(mockDb);
    const result = await svc.get();
    expect(mockDao.get).toHaveBeenCalled();
    expect(result).toEqual({ defaultApiKey: "key", defaultModel: "gpt-4" });
  });

  it("update delegates to dao.update", async () => {
    const svc = createSettingsService(mockDb);
    const data = { defaultApiKey: "new-key" };
    await svc.update(data);
    expect(mockDao.update).toHaveBeenCalledWith(data);
  });
});
