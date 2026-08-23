import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { getConnectionTestEntry } from "./getConnectionTestEntry";

const catalog = [
  { runtime: "mastra", runtimeConfigId: null },
  { runtime: "codex", runtimeConfigId: "local-codex" },
] as AgentRuntimeCatalogEntry[];

describe("getConnectionTestEntry", () => {
  it("does not select an unconfigured runtime when the sheet is closed", () => {
    expect(getConnectionTestEntry(catalog, null)).toBeUndefined();
  });

  it("selects the runtime requested by its config ID", () => {
    expect(getConnectionTestEntry(catalog, "local-codex")?.runtime).toBe("codex");
  });
});
