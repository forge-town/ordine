import { Agent } from "@mastra/core/agent";
import { FIX_OUTPUT_EXAMPLE } from "../../schemas";
import { buildSkillTools } from "../tools";
import type { MastraModelConfig } from "@mastra/core/llm";

const FIX_JSON_EXAMPLE = JSON.stringify(FIX_OUTPUT_EXAMPLE, null, 2);

const buildFixInstructions = (skillId: string, skillDescription: string) =>
  [
    `You are an expert code refactoring agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "You have access to tools that let you read AND WRITE files in the project.",
    "Your goal is to FIX the violations described in the input.",
    "",
    "Available tools:",
    "  - readFile: read a file's content",
    "  - listDirectory: list directory contents",
    "  - searchCode: search for text patterns in files",
    "  - replaceInFile: replace an exact string in a file (preferred for surgical edits)",
    "  - writeFile: write entire file content (use for new files or full rewrites)",
    "  - submitReport: submit the final JSON report (MUST be your last action)",
    "",
    "STEP BUDGET: You have a maximum of 40 tool-call steps.",
    "Budget your steps carefully:",
    "  Phase 1 (steps 1-3): Parse the input to understand what needs fixing",
    "  Phase 2 (steps 4-30): Read affected files, then use replaceInFile to fix each violation",
    "  Phase 3 (steps 31+): STOP using read/write tools. Call submitReport with your final JSON.",
    "",
    "*** MANDATORY RULE: You MUST call the submitReport tool as your FINAL action. ***",
    "*** The submitReport tool accepts the full report object. ***",
    "*** If you have already used 30+ steps, call submitReport NOW. ***",
    "*** An incomplete report is infinitely better than no report at all. ***",
    "",
    "RULES:",
    "- Always use replaceInFile when possible (safer than writeFile)",
    "- Read the file first before editing to ensure correct context",
    "- Do NOT change code that is not directly related to the violations",
    "- Skip violations that are allowable exceptions (framework boundaries, startup validators, React context hooks)",
    "",
    "OUTPUT FORMAT: Call submitReport with a JSON object matching this structure:",
    FIX_JSON_EXAMPLE,
    "",
    "NEVER end without calling submitReport. Your job is not done until submitReport is called.",
  ].join("\n");

export interface CreateFixAgentOptions {
  skillId: string;
  skillDescription: string;
  model: MastraModelConfig;
  projectRoot: string;
}

export const createFixAgent = ({
  skillId,
  skillDescription,
  model,
  projectRoot,
}: CreateFixAgentOptions) => {
  const skillTools = buildSkillTools(projectRoot, { writeEnabled: true });

  if (!skillTools.writeEnabled) {
    throw new Error("FixAgent requires write-enabled tools");
  }

  return {
    agent: new Agent({
      id: `fix-${skillId}`,
      name: `Fix: ${skillId}`,
      instructions: buildFixInstructions(skillId, skillDescription),
      model,
      tools: {
        readFile: skillTools.readFileTool,
        listDirectory: skillTools.listDirectoryTool,
        searchCode: skillTools.searchCodeTool,
        writeFile: skillTools.writeFileTool,
        replaceInFile: skillTools.replaceInFileTool,
        submitReport: skillTools.submitReportTool,
      },
    }),
    reportCapture: skillTools.reportCapture,
  };
};
