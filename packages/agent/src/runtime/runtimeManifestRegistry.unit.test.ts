import { AgentRuntimeSchema } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import { RUNTIME_MANIFESTS, getRuntimeManifest } from "./runtimeManifestRegistry";

describe("runtimeManifestRegistry", () => {
  it("declares exactly one manifest for every supported runtime enum value", () => {
    const runtimeIds = RUNTIME_MANIFESTS.map((manifest) => manifest.runtime);

    expect(new Set(runtimeIds).size).toBe(runtimeIds.length);
    expect([...runtimeIds].sort()).toEqual([...AgentRuntimeSchema.options].sort());
  });

  it("marks protocol adapters experimental until their runtime probe passes", () => {
    expect(getRuntimeManifest("deepseek-harness").supportLevel).toBe("experimental");
    expect(getRuntimeManifest("mistral-vibe").streamFormat).toBe("acp-json-rpc");
  });
});
