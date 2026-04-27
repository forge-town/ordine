import { describe, it, expect, vi } from "vitest";

const mockDao = {
  get: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "codex",
    defaultApiKey: "key",
    defaultModel: "gpt-4",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }),
  update: vi.fn().mockResolvedValue({
    defaultAgentRuntime: "codex",
    defaultApiKey: "new-key",
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }),
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
    expect(result).toEqual({
      defaultAgentRuntime: "codex",
      defaultApiKey: "key",
      defaultModel: "gpt-4",
      meta: { createdAt: new Date(0), updatedAt: new Date(0) },
    });
  });

  it("update delegates to dao.update", async () => {
    const svc = createSettingsService({} as never);
    const data = { defaultApiKey: "new-key" } as never;
    await svc.update(data);
    expect(mockDao.update).toHaveBeenCalledWith(data);
  });

  it("normalizes invalid stored agent runtime", async () => {
    mockDao.get.mockResolvedValueOnce({
      defaultAgentRuntime: "kimi",
      defaultApiKey: "key",
      defaultModel: "kimi-for-coding/k2p6",
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });

    const svc = createSettingsService({} as never);
    const result = await svc.get();

    expect(result.defaultAgentRuntime).toBe("mastra");
  });
});
