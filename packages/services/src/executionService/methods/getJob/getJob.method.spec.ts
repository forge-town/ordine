import { describe, expect, it } from "vitest";
import { createScopedHelper } from "../../helpers/scoped";
import { createGetJobMethod } from "./getJob.method";
import { ExecutionPrincipalSchema } from "@repo/schemas";
const principal = ExecutionPrincipalSchema.parse({ workspaceId: "w", subjectId: "s", scopes: [] });
describe("getJob", () => {
  it("enforces the required scope before repository access", async () => {
    const method = createGetJobMethod({
      scoped: createScopedHelper({} as never),
      deps: {} as never,
      requireJob: async () => {
        throw new Error("unexpected repository access");
      },
    } as never);
    const result = await method(principal, "job");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });
});
