import { describe, expect, it } from "vitest";
import { createResourceControlDescribeMethod } from "./resourceControlDescribe.method";

describe("resourceControlDescribe", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = createResourceControlDescribeMethod({})("job");
    expect(result._unsafeUnwrap().data).toEqual({
      resourceType: "job",
      create: null,
      update: null,
    });
  });
});
