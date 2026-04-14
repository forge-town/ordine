import { Agent } from "@mastra/core/agent";
import { CHECK_OUTPUT_EXAMPLE } from "../../schemas";
import { buildSkillTools } from "../tools";
import type { MastraModelConfig } from "@mastra/core/llm";

const CHECK_JSON_EXAMPLE = JSON.stringify(CHECK_OUTPUT_EXAMPLE, null, 2);

const buildCheckInstructions = (skillId: string, skillDescription: string) =>
  [
    `You are an expert code analysis agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "You have access to tools that let you read files and explore the project.",
    "Use these tools to examine actual source code before making conclusions.",
    "",
    "STEP BUDGET: You have a maximum of 40 tool-call steps.",
    "Budget your steps carefully:",
    "  Phase 1 (steps 1-5): Use searchCode and listDirectory to find relevant files",
    "  Phase 2 (steps 6-25): Use readFile on the most important files found",
    "  Phase 3 (steps 26+): STOP using read/search tools. Call submitReport with your final JSON.",
    "",
    "*** MANDATORY RULE: You MUST call the submitReport tool as your FINAL action. ***",
    "*** The submitReport tool accepts the full report object. ***",
    "*** If you have already used 25+ steps, call submitReport NOW. ***",
    "*** An incomplete report is infinitely better than no report at all. ***",
    "",
    "OUTPUT FORMAT: Call submitReport with a JSON object matching this structure:",
    CHECK_JSON_EXAMPLE,
    "",
    "Include specific file paths, line numbers, code snippets, and suggestions.",
    "Mark findings that are allowed exceptions with skipped: true and provide skipReason.",
    "NEVER end without calling submitReport. Your job is not done until submitReport is called.",
  ].join("\n");

export interface CreateCheckAgentOptions {
  skillId: string;
  skillDescription: string;
  model: MastraModelConfig;
  projectRoot: string;
}

export const createCheckAgent = ({
  skillId,
  skillDescription,
  model,
  projectRoot,
}: CreateCheckAgentOptions) => {
  const skillTools = buildSkillTools(projectRoot, { writeEnabled: false });

  return {
    agent: new Agent({
      id: `check-${skillId}`,
      name: `Check: ${skillId}`,
      instructions: buildCheckInstructions(skillId, skillDescription),
      model,
      tools: {
        readFile: skillTools.readFileTool,
        listDirectory: skillTools.listDirectoryTool,
        searchCode: skillTools.searchCodeTool,
        submitReport: skillTools.submitReportTool,
      },
    }),
    reportCapture: skillTools.reportCapture,
  };
};
