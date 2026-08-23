import { z } from "zod/v4";
import { describe, expect, it } from "vitest";
import { parsePlanningResult } from "./parsePlanningResult";

const ResultSchema = z.object({
  type: z.literal("proposal"),
  proposal: z.object({ purpose: z.string() }),
});

describe("parsePlanningResult", () => {
  it("selects the last schema-compatible object after progress messages", () => {
    const raw = [
      '{"status":"planning","message":"Inspecting {context}"}',
      '{"status":"working","message":"Building"}',
      '{"type":"proposal","proposal":{"purpose":"Create a geography exam"}}',
    ].join("\n");

    expect(parsePlanningResult(raw, ResultSchema)).toEqual({
      type: "proposal",
      proposal: { purpose: "Create a geography exam" },
    });
  });

  it("preserves support for fenced JSON", () => {
    expect(
      parsePlanningResult(
        'Result:\n```json\n{"type":"proposal","proposal":{"purpose":"Draft"}}\n```',
        ResultSchema,
      ),
    ).toEqual({ type: "proposal", proposal: { purpose: "Draft" } });
  });

  it("rejects output without a schema-compatible object", () => {
    expect(() =>
      parsePlanningResult('{"status":"completed","pipelineId":"draft"}', ResultSchema),
    ).toThrow();
  });
});
