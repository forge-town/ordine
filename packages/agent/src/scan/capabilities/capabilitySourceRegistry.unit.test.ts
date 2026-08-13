import { describe, expect, it } from "vitest";
import { AGENT_RUNTIME_ENUM } from "@repo/schemas";
import { CAPABILITY_SOURCE_SUPPORT, RUNTIME_CAPABILITY_SUPPORT } from "./capabilitySourceRegistry";

describe("capability source registry", () => {
  it("covers every executable runtime explicitly", () => {
    expect(Object.keys(RUNTIME_CAPABILITY_SUPPORT).sort()).toEqual(
      Object.values(AGENT_RUNTIME_ENUM).sort(),
    );
  });

  it("records intentional exceptions instead of silently omitting them", () => {
    expect(CAPABILITY_SOURCE_SUPPORT["pi-agent"]).toEqual({
      mcp: "unsupported",
      skills: "supported",
    });
    expect(CAPABILITY_SOURCE_SUPPORT.mastra).toEqual({
      mcp: "not_applicable",
      skills: "not_applicable",
    });
    expect(CAPABILITY_SOURCE_SUPPORT.cursor).toEqual({
      mcp: "supported",
      skills: "supported",
    });
  });
});
