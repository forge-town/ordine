import { describe, expect, it } from "vitest";
import { withPipelineCanvasSkill } from "./pipelineCanvasSkillContext.helper";
describe("pipelineCanvasSkillContext", () => {
  it("retains the Pipeline content and error boundary", () => {
    const prompt = withPipelineCanvasSkill("  task  ");
    expect(prompt).toMatch(/^task/);
    expect(prompt).toContain("## Active skill — ordine-create-pipeline");
    expect(prompt).toContain("### Bundled reference: references/pipeline-anatomy.md");
  });
});
