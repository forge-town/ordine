import { describe, expect, it } from "vitest";
import { PipelineActionProposalSchema } from "@repo/schemas";
import { normalizeProposalPayload } from "./normalizeProposalPayload";

/**
 * N20-01：带 loop 字段的 operation 提案必须穿过 normalize + schema 校验，
 * loopEnabled / maxLoopCount / loopConditionPrompt 三字段不得被剥离——
 * 否则画布画了迭代环、引擎却收不到 loop 配置（伪造）。
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
            loopConditionPrompt: "Inspect the quiz; return PASS if every answer is correct, else FAIL.",
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
