import { describe, expect, it } from "vitest";
import { SkillSchema } from "@repo/schemas";
import { createSkillsService } from "../../skills.service";
describe("buildDraftOperation", () => {
  it("retains the source skill and skill executor reference in an editable operation draft", () => {
    const skill = SkillSchema.parse({
      id: "skill-1",
      name: "review",
      label: "Review Code",
      description: "Review evidence",
      category: "code",
      tags: [],
    });
    const draft = createSkillsService({} as never).buildDraftOperation(skill);
    expect(draft).toMatchObject({
      name: "Review Code",
      description: "Review evidence",
      sourceSkillId: "skill-1",
      config: {
        executor: { type: "agent", agentMode: "skill", skillId: "skill-1" },
        inputs: [],
        outputs: [],
      },
    });
  });
});
