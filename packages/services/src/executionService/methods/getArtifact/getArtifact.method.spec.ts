import { describe, expect, it } from "vitest";
import { errAsync } from "neverthrow";
import { createGetArtifactMethod } from "./getArtifact.method";
describe("getArtifact", () => {
  it("maps artifact storage failures to the service error contract", async () => {
    const result = await createGetArtifactMethod({
      deps: {
        artifactStore: {
          readArtifact: () =>
            errAsync({ code: "MISSING", message: "missing", retryable: false, stage: "artifact" }),
        },
      } as never,
    })({ workspaceId: "w", subjectId: "s", scopes: [] } as never, "artifact");
    expect(result.isErr()).toBe(true);
  });
});
