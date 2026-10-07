import { describe, expect, it } from "vitest";
import { createResourceControlArchiveMethod } from "./resourceControlArchive.method";

describe("resourceControlArchive", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createResourceControlArchiveMethod({} as never)("pipeline", "pipeline-1");
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "EXPECTED_VERSION_REQUIRED",
      field: "expectedVersion",
    });
  });
});
