import { describe, expect, it } from "vitest";
import {
  AgentExecutionChoiceSchema,
  AgentRuntimePreferencesSchema,
} from "./AgentExecutionChoiceSchema";

describe("AgentExecutionChoiceSchema", () => {
  it("preserves a runtime-scoped model, reasoning, and speed choice", () => {
    const choice = {
      runtimeConfigId: "local-codex",
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      speed: "priority",
    };

    expect(AgentExecutionChoiceSchema.parse(choice)).toEqual(choice);
    expect(AgentRuntimePreferencesSchema.parse({ "local-codex": choice })).toEqual({
      "local-codex": {
        model: choice.model,
        reasoningEffort: choice.reasoningEffort,
        speed: choice.speed,
      },
    });
  });

  it("rejects blank persisted values", () => {
    expect(
      AgentExecutionChoiceSchema.safeParse({ runtimeConfigId: "local-codex", model: "" }).success,
    ).toBe(false);
  });
});
