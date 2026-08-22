import { describe, expect, it } from "vitest";
import { LocalConnectionSchema } from "./LocalConnectionSchema";

describe("LocalConnectionSchema", () => {
  it("preserves optional local runtime detection metadata", () => {
    const connection = {
      mode: "local",
      binaryName: "codex",
      path: "C:\\tools\\codex.exe",
      version: "codex-cli 1.2.3",
      detectedAt: "2026-08-12T08:00:00.000Z",
      modelsSource: "live",
      models: [
        {
          id: "gpt-5.6-sol",
          displayName: "GPT-5.6-Sol",
          isDefault: true,
          defaultReasoningEffort: "low",
          reasoningEfforts: [{ value: "low", description: "Fast responses" }],
          speeds: [{ value: "fast", label: "Fast" }],
          supportsImageInput: true,
        },
      ],
    } as const;

    expect(LocalConnectionSchema.parse(connection)).toEqual(connection);
  });
});
