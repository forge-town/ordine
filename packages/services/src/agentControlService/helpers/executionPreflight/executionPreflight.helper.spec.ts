import { describe, expect, it, vi } from "vitest";
import { okAsync } from "neverthrow";
vi.mock("@repo/models", () => ({
  createOperationsDao: () => ({ findById: vi.fn().mockResolvedValue(null) }),
  createPipelinesDao: () => ({}),
  createRoutinesDao: () => ({}),
}));
vi.mock("../../../capabilityCatalogService", () => ({
  createCapabilityCatalogService: () => ({ getMany: () => okAsync([]) }),
}));
import { createExecutionPreflight } from "./executionPreflight.helper";
describe("executionPreflight", () => {
  it("retains a typed missing-operation result through the assembled preflight", async () => {
    const result = await createExecutionPreflight({} as never).operation("missing");
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "OPERATION_NOT_FOUND" });
  });
});
