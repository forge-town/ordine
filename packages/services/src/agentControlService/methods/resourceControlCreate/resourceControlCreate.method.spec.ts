import { describe, expect, it } from "vitest";
import { createResourceControlCreateMethod } from "./resourceControlCreate.method";

describe("resourceControlCreate", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlCreateMethod({} as never)("project", { name: "" });
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().field).toBe("name");
  });
});
