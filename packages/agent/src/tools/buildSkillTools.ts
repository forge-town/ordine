import { createReadFileTool } from "./readFileTool";
import { createListDirectoryTool } from "./listDirectoryTool";
import { createSearchCodeTool } from "./searchCodeTool";
import { createWriteFileTool } from "./writeFileTool";
import { createReplaceInFileTool } from "./replaceInFileTool";

export const buildSkillTools = (projectRoot: string, opts?: { writeEnabled?: boolean }) => {
  const readFileTool = createReadFileTool(projectRoot);
  const listDirectoryTool = createListDirectoryTool(projectRoot);
  const searchCodeTool = createSearchCodeTool(projectRoot);

  if (!opts?.writeEnabled) {
    return {
      readFileTool,
      listDirectoryTool,
      searchCodeTool,
      writeEnabled: false as const,
    };
  }

  const writeFileTool = createWriteFileTool(projectRoot);
  const replaceInFileTool = createReplaceInFileTool(projectRoot);

  return {
    readFileTool,
    listDirectoryTool,
    searchCodeTool,
    writeFileTool,
    replaceInFileTool,
    writeEnabled: true as const,
  };
};
