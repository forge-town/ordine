import { describe, expect, it } from "vitest";
import { buildConfig, parseExecutorDefaults, type EditFormValues } from "./editFormSchema";

const baseValues: EditFormValues = {
  name: "Publish",
  description: "",
  acceptedObjectTypes: ["folder"],
  executorType: "publish",
  agentMode: "skill",
  skillId: "",
  promptText: "",
  scriptCommand: "",
  scriptLanguage: "bash",
  publishTarget: "git",
  repo: "forge-town/ui-kit",
  branch: "main",
  subPath: "components/bifrost",
  commitMessage: "Publish components",
  openPr: true,
  outputs: [],
};

describe("editFormSchema · publish executor", () => {
  it("buildConfig maps publish form values to a publish executor config", () => {
    const config = buildConfig(baseValues);
    expect(config.executor).toEqual({
      type: "publish",
      publishTarget: "git",
      repo: "forge-town/ui-kit",
      branch: "main",
      subPath: "components/bifrost",
      commitMessage: "Publish components",
      openPr: true,
    });
  });

  it("drops empty optional publish fields (undefined, not empty string)", () => {
    const config = buildConfig({ ...baseValues, branch: "", subPath: "", commitMessage: "" });
    expect(config.executor).toMatchObject({
      type: "publish",
      branch: undefined,
      subPath: undefined,
      commitMessage: undefined,
    });
  });

  it("parseExecutorDefaults round-trips a publish config back to form values", () => {
    const config = buildConfig(baseValues);
    const parsed = parseExecutorDefaults(config);
    expect(parsed.executorType).toBe("publish");
    expect(parsed.publishTarget).toBe("git");
    expect(parsed.repo).toBe("forge-town/ui-kit");
    expect(parsed.openPr).toBe(true);
  });

  it("defaults openPr to true for a publish config without openPr", () => {
    const parsed = parseExecutorDefaults({ executor: { type: "publish", publishTarget: "git" } });
    expect(parsed.openPr).toBe(true);
    expect(parsed.publishTarget).toBe("git");
  });

  it("leaves agent/script configs untouched", () => {
    expect(buildConfig({ ...baseValues, executorType: "script" }).executor).toMatchObject({
      type: "script",
    });
    expect(
      buildConfig({ ...baseValues, executorType: "agent", agentMode: "prompt" }).executor,
    ).toMatchObject({ type: "agent", agentMode: "prompt" });
  });
});
