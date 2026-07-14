import { describe, expect, it } from "vitest";
import * as models from "../index";

describe("COD-116 DAO exports", () => {
  it("exports all new DAO factories and excludes annotations", () => {
    expect([
      models.createProjectsDao,
      models.createConnectorsDao,
      models.createConversationMessagesDao,
      models.createRoutinesDao,
      models.createPipelineAssetsDao,
      models.createUsageDao,
    ]).toEqual([
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    ]);
    expect(models).not.toHaveProperty("createAnnotationsDao");
  });
});
