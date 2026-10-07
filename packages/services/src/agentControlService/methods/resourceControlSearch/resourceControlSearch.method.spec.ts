import { describe, expect, it } from "vitest";
import { createResourceControlSearchMethod } from "./resourceControlSearch.method";

describe("resourceControlSearch", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlSearchMethod({} as never)({
      query: "",
      cursor: "-1",
      limit: 10,
    });
    expect(result._unsafeUnwrapErr()).toMatchObject({ code: "INVALID_CURSOR", field: "cursor" });
  });
});
