import { describe, expect, it } from "vitest";
import { createScopedHelper } from "../../helpers/scoped";
import { createSaveWorkspaceSettingsMethod } from "./saveWorkspaceSettings.method";
import { ExecutionPrincipalSchema } from "@repo/schemas";
const principal = ExecutionPrincipalSchema.parse({ workspaceId: "w", subjectId: "s", scopes: [] });
describe("saveWorkspaceSettings", () => {
  it("enforces the required scope before repository access", async () => {
    const method = createSaveWorkspaceSettingsMethod({
      scoped: createScopedHelper({} as never),
      deps: {} as never,
      requireJob: async () => {
        throw new Error("unexpected repository access");
      },
    } as never);
    const result = await method(principal, {});
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().code).toBe("FORBIDDEN");
  });
});
