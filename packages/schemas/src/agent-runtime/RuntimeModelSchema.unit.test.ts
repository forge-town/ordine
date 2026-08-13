import { describe, expect, it } from "vitest";
import { RuntimeModelSchema } from "./RuntimeModelSchema";

describe("RuntimeModelSchema", () => {
  it("preserves normalized model capability metadata", () => {
    const model = {
      id: "gpt-5.6-sol",
      displayName: "GPT-5.6-Sol",
      description: "Latest frontier agentic coding model.",
      isDefault: true,
      defaultReasoningEffort: "low",
      reasoningEfforts: [
        { value: "low", description: "Fast responses" },
        { value: "high", label: "High" },
      ],
      defaultSpeed: "standard",
      speeds: [
        { value: "standard", label: "Standard" },
        { value: "fast", label: "Fast" },
      ],
      supportsImageInput: true,
    } as const;

    expect(RuntimeModelSchema.parse(model)).toEqual(model);
  });

  it("keeps unadvertised capabilities absent", () => {
    expect(RuntimeModelSchema.parse({ id: "custom", displayName: "Custom" })).toEqual({
      id: "custom",
      displayName: "Custom",
    });
  });
});
