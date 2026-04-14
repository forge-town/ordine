/**
 * Skill executor — runs a skill using a Mastra Agent with tools.
 *
 * For project paths: creates an Agent with file-system tools (readFile,
 * listDirectory, searchCode, optionally writeFile/replaceInFile).
 * For non-project: falls back to streaming prompt without tools.
 */

import { streamText } from "ai";
import { Agent } from "@mastra/core/agent";
import { ResultAsync, ok } from "neverthrow";
import {
  getLlmModel,
  getMastraModelConfig,
  type LlmOverride,
  type LogFn,
  type SettingsResolver,
  noopLog,
} from "./llm";
import { buildSkillTools } from "./tools";
import { extractStructuredOutput } from "./output";
import { CHECK_OUTPUT_EXAMPLE, FIX_OUTPUT_EXAMPLE } from "./schemas";
import type { StreamCallback } from "./prompt-executor";

export const runSkill = (
  skillId: string,
  skillDescription: string,
  inputContent: string,
  inputPath: string,
  getSettings: SettingsResolver,
  override?: LlmOverride,
  onChunk?: StreamCallback,
  log: LogFn = noopLog,
  opts?: { writeEnabled?: boolean },
): ResultAsync<string, never> => {
  const isImplementMode = opts?.writeEnabled === true;

  const CHECK_JSON_EXAMPLE = JSON.stringify(CHECK_OUTPUT_EXAMPLE, null, 2);
  const FIX_JSON_EXAMPLE = JSON.stringify(FIX_OUTPUT_EXAMPLE, null, 2);

  const checkInstructions = [
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

  const implementInstructions = [
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

  const instructions = isImplementMode ? implementInstructions : checkInstructions;

  const userPrompt = inputPath
    ? `Project path: ${inputPath}\n\nInput:\n${inputContent}`
    : `Input:\n${inputContent}`;

  const generateFallbackReport = (): string => {
    const fallback = isImplementMode
      ? {
          type: "fix" as const,
          summary: `LLM analysis unavailable for skill "${skillId}". No changes made.`,
          changes: [],
          remainingFindings: [],
          stats: {
            totalChanges: 0,
            filesModified: 0,
            findingsFixed: 0,
            findingsSkipped: 0,
          },
        }
      : {
          type: "check" as const,
          summary: `LLM analysis unavailable for skill "${skillId}". Input forwarded as-is.`,
          findings: [],
          stats: {
            totalFiles: 0,
            totalFindings: 0,
            errors: 0,
            warnings: 0,
            infos: 0,
            skipped: 0,
          },
        };
    return JSON.stringify(fallback, null, 2);
  };

  return ResultAsync.fromPromise(
    (async () => {
      await log(
        `[Mastra] runSkill: skillId=${skillId}, input length=${inputContent.length}, inputPath=${inputPath}`,
      );
      await log(`[Mastra] runSkill: instructions length=${instructions.length}`);

      // Use Mastra Agent with tools if we have a project path
      if (inputPath) {
        const modelConfig = await getMastraModelConfig(getSettings, override, log);
        if (!modelConfig) {
          await log(`[Mastra] runSkill: No model config — returning fallback report`);
          return generateFallbackReport();
        }

        const skillTools = buildSkillTools(inputPath, {
          writeEnabled: isImplementMode,
        });

        const agent = new Agent({
          id: `skill-${skillId}`,
          name: `Skill: ${skillId}`,
          instructions,
          model: modelConfig,
          tools: skillTools.writeEnabled
            ? {
                readFile: skillTools.readFileTool,
                listDirectory: skillTools.listDirectoryTool,
                searchCode: skillTools.searchCodeTool,
                writeFile: skillTools.writeFileTool,
                replaceInFile: skillTools.replaceInFileTool,
              }
            : {
                readFile: skillTools.readFileTool,
                listDirectory: skillTools.listDirectoryTool,
                searchCode: skillTools.searchCodeTool,
              },
        });

        await log(`[Mastra] runSkill: Starting agent.generate (tool-use mode)...`);

        const MAX_ATTEMPTS = 2;
        const generateWithRetry = async (): Promise<Awaited<
          ReturnType<typeof agent.generate>
        > | null> => {
          for (const attempt of Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1)) {
            try {
              return await agent.generate(userPrompt, {
                maxSteps: 25,
                ...(attempt > 1
                  ? {
                      providerOptions: {
                        openai: { reasoning_effort: "none" },
                      },
                    }
                  : {}),
              });
            } catch (error) {
              const errMsg = error instanceof Error ? error.message : String(error);
              const isThinkingError = errMsg.includes("reasoning_content");
              await log(
                `[Mastra] runSkill: agent.generate THREW (attempt ${attempt}/${MAX_ATTEMPTS}) — ${errMsg}`,
              );

              if (isThinkingError && attempt < MAX_ATTEMPTS) {
                await log(`[Mastra] runSkill: Retrying with reasoning disabled...`);
                continue;
              }

              return null;
            }
          }
          return null;
        };

        const result = await generateWithRetry();
        if (!result) return generateFallbackReport();

        const stepCount = result.steps?.length ?? 0;
        const toolCallCount = (result.steps ?? []).reduce(
          (acc, step) => acc + (step.toolCalls?.length ?? 0),
          0,
        );

        // If result.text is empty, try to salvage text from intermediate steps
        const outputText = (() => {
          if (result.text) return result.text;
          if (result.steps?.length) {
            const stepTexts = result.steps.map((s) => s.text ?? "").filter((t) => t.length > 50);
            if (stepTexts.length > 0) return stepTexts.at(-1) ?? "";
          }
          return "";
        })();
        if (!result.text && outputText) {
          await log(`[Mastra] runSkill: Salvaged ${outputText.length} chars from step text`);
        }

        await log(
          `[Mastra] runSkill: Agent complete, steps=${stepCount}, tool calls=${toolCallCount}, output=${outputText.length} chars`,
        );

        if (onChunk) await onChunk(outputText);

        if (outputText.length === 0) {
          await log(
            `[Mastra] runSkill: WARNING — Agent returned empty output, using fallback report`,
          );
          return generateFallbackReport();
        }
        return extractStructuredOutput(outputText, log);
      }

      // Fallback to streaming without tools if no project path
      const model = await getLlmModel(getSettings, override, log);
      if (!model) {
        await log(`[Mastra] runSkill: No LLM model — returning fallback report`);
        return generateFallbackReport();
      }
      await log(`[Mastra] runSkill: Starting streamText (no project path)...`);
      const result = streamText({
        model,
        system: instructions,
        prompt: userPrompt,
      });
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
        if (onChunk) await onChunk(chunks.join(""));
      }
      const accumulated = chunks.join("");
      await log(
        `[Mastra] runSkill: Stream complete, chunks=${chunks.length}, total output=${accumulated.length} chars`,
      );
      if (accumulated.length === 0) {
        await log(`[Mastra] runSkill: WARNING — LLM returned empty output, using fallback report`);
        return generateFallbackReport();
      }
      return extractStructuredOutput(accumulated, log);
    })(),
    (cause) => cause,
  ).orElse((cause) => {
    const errMsg = cause instanceof Error ? cause.message : String(cause);
    void log(`[Mastra] runSkill: Agent call FAILED — ${errMsg}`);
    return ok(generateFallbackReport());
  });
};
