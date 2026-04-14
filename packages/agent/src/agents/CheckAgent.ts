import { Agent } from "@mastra/core/agent";
import { CHECK_OUTPUT_EXAMPLE } from "../schemas";
import { buildSkillTools } from "../tools";
import type { MastraModelConfig } from "../providers";

const CHECK_JSON_EXAMPLE = JSON.stringify(CHECK_OUTPUT_EXAMPLE, null, 2);

const buildCheckInstructions = (skillId: string, skillDescription: string) =>
  [
    `You are an expert code analysis agent executing the skill "${skillId}".`,
    `Skill description: ${skillDescription}`,
    "",
    "You have access to tools that let you read files and explore the project.",
    "Use these tools to examine actual source code before making conclusions.",
    "",
    "CRITICAL CONSTRAINT — You have a HARD LIMIT of 25 tool-call steps.",
    "If you exceed this limit, your response will be CUT OFF and LOST entirely.",
    "Budget your steps wisely:",
    "  Phase 1 (steps 1-5): Use searchCode and listDirectory to find relevant files",
    "  Phase 2 (steps 6-18): Use readFile on the most important files found",
    "  Phase 3 (step 19+): STOP all tool calls and write your report",
    "",
    "DO NOT call any more tools after step 18. Write the report immediately.",
    "If in doubt whether to read one more file or write the report — WRITE THE REPORT.",
    "",
    "OUTPUT FORMAT: Your final message MUST be a single JSON object wrapped in ```json fences.",
    "Output data conforming to this structure (replace example values with real data):",
    "```json",
    CHECK_JSON_EXAMPLE,
    "```",
    "",
    "Include specific file paths, line numbers, code snippets, and suggestions.",
    "Mark findings that are allowed exceptions with skipped: true and provide skipReason.",
    "NEVER end your response with a tool call. Always end with the JSON output.",
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

  return new Agent({
    id: `check-${skillId}`,
    name: `Check: ${skillId}`,
    instructions: buildCheckInstructions(skillId, skillDescription),
    model,
    tools: {
      readFile: skillTools.readFileTool,
      listDirectory: skillTools.listDirectoryTool,
      searchCode: skillTools.searchCodeTool,
    },
  });
};
