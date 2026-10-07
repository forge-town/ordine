import { describe, expect, it, vi } from "vitest";
import { ok } from "neverthrow";
import { createReadArtifactMethod } from "./readArtifact.method";
import { ExecutionPrincipalSchema } from "@repo/schemas";
const principal = ExecutionPrincipalSchema.parse({ workspaceId: "w", subjectId: "s", scopes: [] });
describe("readArtifact", () => {
  it("delegates the artifact range and preserves the result", async () => {
    const readArtifact = vi.fn(() => ok({ content: "data" }));
    const method = createReadArtifactMethod({ deps: { artifactStore: { readArtifact } } } as never);
    const result = await method(principal, "artifact", { offset: 2, length: 3 });
    expect(result._unsafeUnwrap()).toEqual({ content: "data" });
    expect(readArtifact).toHaveBeenCalledWith(principal, "artifact", { offset: 2, length: 3 });
  });
});
