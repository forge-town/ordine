import { createReadFileTool } from "./readFileTool";
import { createListDirectoryTool } from "./listDirectoryTool";
import { createSearchCodeTool } from "./searchCodeTool";
import { createWriteFileTool } from "./writeFileTool";
import { createReplaceInFileTool } from "./replaceInFileTool";
import { createSubmitReportTool, type ReportCapture } from "./submitReportTool";

export const buildSkillTools = (projectRoot: string, opts?: { writeEnabled?: boolean }) => {
  const readFileTool = createReadFileTool(projectRoot);
  const listDirectoryTool = createListDirectoryTool(projectRoot);
  const searchCodeTool = createSearchCodeTool(projectRoot);
  const reportCapture: ReportCapture = { report: null };
  const submitReportTool = createSubmitReportTool(reportCapture);

  if (!opts?.writeEnabled) {
    return {
      readFileTool,
      listDirectoryTool,
      searchCodeTool,
      submitReportTool,
      reportCapture,
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
    submitReportTool,
    reportCapture,
    writeEnabled: true as const,
  };
};
