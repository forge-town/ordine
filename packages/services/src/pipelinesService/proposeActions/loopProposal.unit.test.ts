import { describe, expect, it } from "vitest";
import { PipelineActionProposalSchema } from "@repo/schemas";
import { normalizeProposalPayload } from "./normalizeProposalPayload";

/**
 * An operation proposal carrying loop fields must survive normalize + schema
 * validation: loopEnabled / maxLoopCount / loopConditionPrompt must not be
 * stripped — otherwise the canvas draws an iteration loop while the engine
 * never receives the loop config (a fabricated loop).
 */
describe("loop operation proposal survives normalize + schema", () => {
  const rawProposal = {
    summary: "Generate quiz then self-critique until correct",
    actions: [
      {
        type: "addNode",
        node: {
          id: "node_quiz",
          type: "operation",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "operation",
            label: "生成并自检测验",
            operationId: "op_quiz",
            operationName: "Generate Quiz",
            status: "idle",
            loopEnabled: true,
            maxLoopCount: 3,
            loopConditionPrompt:
              "Inspect the quiz; return PASS if every answer is correct, else FAIL.",
          },
        },
      },
    ],
  };

  it("keeps loop fields through normalizeProposalPayload", () => {
    const normalized = normalizeProposalPayload(rawProposal) as typeof rawProposal;
    const data = normalized.actions[0]!.node.data;

    expect(data.loopEnabled).toBe(true);
    expect(data.maxLoopCount).toBe(3);
    expect(data.loopConditionPrompt).toContain("PASS");
  });

  it("passes PipelineActionProposalSchema validation", () => {
    const normalized = normalizeProposalPayload(rawProposal);
    const parsed = PipelineActionProposalSchema.safeParse(normalized);

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const action = parsed.data.actions[0];
      expect(action?.type).toBe("addNode");
      if (action?.type === "addNode" && action.node.data.nodeType === "operation") {
        expect(action.node.data.loopEnabled).toBe(true);
        expect(action.node.data.maxLoopCount).toBe(3);
      }
    }
  });
});
