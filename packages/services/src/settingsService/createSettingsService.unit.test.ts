import { describe, it, expect, vi } from "vitest";

const mockDao = {
  get: vi.fn().mockResolvedValue({ llmApiKey: "key", llmModel: "gpt-4" }),
  update: vi.fn().mockResolvedValue({ llmApiKey: "new-key" }),
};

vi.mock("@repo/models", () => ({
  createSettingsDao: () => mockDao,
}));

import { createSettingsService } from "./createSettingsService";

describe("createSettingsService", () => {
  it("get delegates to dao.get", async () => {
    const svc = createSettingsService({} as never);
    const result = await svc.get();
    expect(mockDao.get).toHaveBeenCalled();
    expect(result).toEqual({ llmApiKey: "key", llmModel: "gpt-4" });
  });

  it("update delegates to dao.update", async () => {
    const svc = createSettingsService({} as never);
    const data = { llmApiKey: "new-key" } as never;
    await svc.update(data);
    expect(mockDao.update).toHaveBeenCalledWith(data);
  });
});
