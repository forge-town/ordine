import { ResultAsync, errAsync } from "neverthrow";
import { logger } from "@repo/logger";
import type { RunPromptOptions } from "@repo/pipeline-engine";
import type { OutputItem, SshConnection } from "@repo/schemas";
import { runAgent } from "../agentRunner/agentRunner";

export class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

const PROMPT_AGENT_ID = "prompt-executor";

type PromptExecutorOptions = RunPromptOptions & { ssh?: SshConnection };

/**
 * N17-03a：执行器缺用户侧配置时输出结构化用户请求标记。
 * 该行会随 onProgress 落入 job_traces，Agent Bar 解析后渲染可交互卡片。
 */
const USER_ACTION_SECTION = [
  "",
  "## When user-side configuration is missing",
  "If you cannot fully complete the task because something only the USER can provide is missing",
  "(e.g. an input folder is not configured or empty, an output destination is unknown, credentials are required),",
  "emit ONE line in this exact format on its own line, then still produce the best partial result you can:",
  '@@USER_ACTION::{"kind":"configure-input","message":"<one short sentence telling the user what to configure>","field":"<optional missing field>"}',
  'Allowed "kind" values: "configure-input", "configure-output", "provide-info".',
  "Do NOT emit the marker when nothing is missing.",
  "",
].join("\n");

const buildOutputItemsSection = (
  outputItems?: readonly OutputItem[],
  outputDir?: string,
): string => {
  if (!outputItems || outputItems.length === 0) return "";
  const lines = [
    "",
    "## Expected Output Items",
    "Your response MUST include ALL of the following output items.",
    ...(outputDir ? [`Write all output files to the directory: ${outputDir}`] : []),
    'Include the file paths in an "outputs" field in your JSON response.',
    ...outputItems.map(
      (item, i) =>
        `${i + 1}. **${item.name}** (${item.contentType})${item.description ? `: ${item.description}` : ""}`,
    ),
    "",
  ];

  return lines.join("\n");
};

const run = ({
  prompt,
  inputContent,
  inputPath,
  jobId,
  agent = "mastra",
  onChunk,
  onProgress,
  apiKey,
  model,
  extraTools,
  githubToken,
  ssh,
  outputItems,
  outputDir,
}: PromptExecutorOptions): ResultAsync<string, PromptExecutionError> => {
  if (!prompt?.trim()) {
    return errAsync(new PromptExecutionError("Prompt text is empty"));
  }

  const outputSection = buildOutputItemsSection(outputItems, outputDir);
  const effectiveInput = outputSection ? `${inputContent}\n${outputSection}` : inputContent;

  return ResultAsync.fromPromise(
    (async () => {
      const raw = await runAgent({
        agent,
        systemPrompt: `${prompt}\n${USER_ACTION_SECTION}`,
        userPrompt: effectiveInput,
        inputPath,
        jobId,
        agentId: PROMPT_AGENT_ID,
        allowedTools: extraTools ?? [],
        onProgress,
        logPrefix: "[LLM] runPrompt",
        apiKey,
        model,
        githubToken,
        ssh,
      });
      if (onChunk) await onChunk(raw);

      return raw;
    })(),
    (cause) => {
      logger.error({ err: cause }, "runPrompt: failed");
      void onProgress?.(
        `[LLM] runPrompt: Error — ${cause instanceof Error ? cause.message : String(cause)}`,
      );

      return cause instanceof PromptExecutionError
        ? cause
        : new PromptExecutionError(
            `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          );
    },
  );
};

export const promptExecutor = {
  run,
};
