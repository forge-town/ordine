import { Agent } from "@mastra/core/agent";
import { FIX_OUTPUT_EXAMPLE } from "../schemas";
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
    "",
    "CRITICAL CONSTRAINT — You have a HARD LIMIT of 25 tool-call steps.",
    "Budget your steps wisely:",
    "  Phase 1 (steps 1-3): Parse the input to understand what needs fixing",
    "  Phase 2 (steps 4-20): Read affected files, then use replaceInFile to fix each violation",
    "  Phase 3 (step 21+): STOP all tool calls and write the output",
    "",
    "RULES:",
    "- Always use replaceInFile when possible (safer than writeFile)",
    "- Read the file first before editing to ensure correct context",
    "- Do NOT change code that is not directly related to the violations",
    "- Skip violations that are allowable exceptions (framework boundaries, startup validators, React context hooks)",
    "",
    "OUTPUT FORMAT: Your final message MUST be a single JSON object wrapped in ```json fences.",
    "Output data conforming to this structure (replace example values with real data):",
    "```json",
    FIX_JSON_EXAMPLE,
    "```",
    "",
    "NEVER end your response with a tool call. Always end with the JSON output.",
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

  return new Agent({
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
    },
  });
};
