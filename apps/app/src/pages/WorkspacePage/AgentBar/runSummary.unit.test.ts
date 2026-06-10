import { describe, expect, it } from "vitest";
import { buildSelfHealSteps } from "./runSummary";

describe("buildSelfHealSteps", () => {
  it("converts self-heal traces into card steps in chronological order", () => {
    expect(
      buildSelfHealSteps([
        { message: "@@SELF_HEAL_DONE::node-a::1" },
        { message: "@@SELF_HEAL::node-a::1::Retrying after failure: missing token" },
        { message: "ordinary trace" },
      ]),
    ).toEqual([
      {
        label: "Retry 1 for node-a - Retrying after failure: missing token",
        tone: "muted",
      },
      {
        label: "Node node-a recovered on retry 1",
        tone: "success",
      },
    ]);
  });
});
