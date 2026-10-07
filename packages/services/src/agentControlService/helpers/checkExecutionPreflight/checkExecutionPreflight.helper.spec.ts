import { describe, expect, it } from "vitest";
import { createCheckExecutionPreflightHelper } from "./checkExecutionPreflight.helper";

describe("checkExecutionPreflight", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createCheckExecutionPreflightHelper({} as never)("ordine.search", {});
    expect(result._unsafeUnwrap()).toBeNull();
  });
});
