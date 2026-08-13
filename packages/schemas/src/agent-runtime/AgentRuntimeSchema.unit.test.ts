import { describe, expect, it } from "vitest";
import { getLocalAgentRuntimeId, parseLocalAgentRuntimeId } from "./AgentRuntimeSchema";

describe("local Agent runtime ids", () => {
  it("round-trips supported local runtime types", () => {
    expect(getLocalAgentRuntimeId("codex")).toBe("local-codex");
    expect(parseLocalAgentRuntimeId("local-codex")).toBe("codex");
    expect(parseLocalAgentRuntimeId("local-claude-code")).toBe("claude-code");
  });

  it("rejects non-local and unsupported ids", () => {
    expect(parseLocalAgentRuntimeId("runtime-codex")).toBeNull();
    expect(parseLocalAgentRuntimeId("local-unknown")).toBeNull();
  });
});
