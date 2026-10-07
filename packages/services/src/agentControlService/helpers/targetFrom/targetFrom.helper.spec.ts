import { describe, expect, it } from "vitest";
import { targetFrom } from "./targetFrom.helper";

describe("targetFrom", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(targetFrom("ordine.prepare_operation_run", { operationId: "operation-1" })).toEqual({
      type: "operation",
      id: "operation-1",
    });
  });
});
