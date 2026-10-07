import { describe, it, expect, vi } from "vitest";
import type { DbConnection } from "@repo/models";

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

import { createSettingsService } from "../../settings.service";

// The DAO factory is mocked above, so the service only needs a typed db token.
const mockDb = {} as DbConnection;

describe("createSettingsService", () => {
  it("update delegates to dao.update", async () => {
    const svc = createSettingsService(mockDb);
    const data = { defaultApiKey: "new-key" } as never;
    await svc.update(data);
    expect(mockDao.update).toHaveBeenCalledWith(data);
  });
});
