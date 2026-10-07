import { describe, expect, it, vi } from "vitest";

const operation = vi.fn().mockResolvedValue(undefined);
vi.mock("@repo/models", () => ({ createConnectorsDao: () => ({ delete: operation }) }));
import { createConnectorsService } from "../../connectors.service";
describe("delete", () => {
  it("returns successful connector removal", async () => {
    const result = await createConnectorsService({} as never).delete("connector-1");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual(undefined);
  });
  it("retains the cause of persistence errors in ServiceError", async () => {
    const cause = new Error("storage unavailable");
    operation.mockRejectedValueOnce(cause);
    const result = await createConnectorsService({} as never).delete("connector-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({ name: "ServiceError", cause });
  });
});
