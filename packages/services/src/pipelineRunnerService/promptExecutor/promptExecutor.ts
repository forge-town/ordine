import { ResultAsync, errAsync } from "neverthrow";
import { logger } from "@repo/logger";
import type { OperationRuntimeContext, RunPromptOptions } from "@repo/pipeline-engine";
import { TRACE_MARKER, type OutputItem, type SshConnection } from "@repo/schemas";
import { runAgent, type McpConnectorInjectionProvider } from "../agentRunner/agentRunner";

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

type PromptExecutorOptions = RunPromptOptions & {
  ssh?: SshConnection;
  getMcpConnectorInjection?: McpConnectorInjectionProvider;
};

/**
 * Instruct the executor to emit a structured user-action marker when it cannot
 * finish because of missing user-side configuration. The marker line flows into
 * job_traces via onProgress, where the frontend renders an interactive card.
 */
const USER_ACTION_SECTION = [
  "",
  "## When user-side configuration is missing",
  "If you cannot fully complete the task because something only the USER can provide is missing",
  "(e.g. an input folder is not configured or empty, an output destination is unknown, credentials are required),",
  "emit ONE line in this exact format on its own line, then still produce the best partial result you can:",
  `${TRACE_MARKER.userAction}{"kind":"configure-input","message":"<one short sentence telling the user what to configure>","field":"<optional missing field>"}`,
  'Allowed "kind" values: "configure-input", "configure-output", "provide-info".',
  "Do NOT emit the marker when nothing is missing.",
  "",
].join("\n");

const buildRuntimeContextSection = (runtimeContext?: OperationRuntimeContext): string => {
  if (!runtimeContext) return "";

  const pipelineLines = runtimeContext.pipeline
    ? [
        "### Pipeline-global context",
        `Pipeline name: ${runtimeContext.pipeline.name}`,
        `Pipeline description: ${runtimeContext.pipeline.description || "(none)"}`,
        `Pipeline shared context: ${runtimeContext.pipeline.sharedContext || "(none)"}`,
        "",
      ]
    : [];

  const operation = runtimeContext.operation;
  const operationLines = [
    "### Operation-local context",
    `Operation name: ${operation.name}`,
    `Operation description: ${operation.description || "(none)"}`,
    ...(operation.instruction ? [`Step-specific instruction: ${operation.instruction}`] : []),
  ];

  return ["## Runtime Context", ...pipelineLines, ...operationLines].join("\n");
};

const buildSystemPrompt = ({
  prompt,
  runtimeContext,
}: {
  prompt: string;
  runtimeContext?: OperationRuntimeContext;
}): string => {
  const contextSection = buildRuntimeContextSection(runtimeContext);
  if (!contextSection) return prompt;

  return [
    contextSection,
    "",
    "## Execution Priority",
    "Use the pipeline-global context to preserve workflow intent, but execute the current Operation-local instruction as the immediate task.",
    "",
    "## Operation Prompt",
    prompt,
  ].join("\n");
};

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
  allowedTools,
  githubToken,
  ssh,
  outputItems,
  outputDir,
  runtimeContext,
  getMcpConnectorInjection,
}: PromptExecutorOptions): ResultAsync<string, PromptExecutionError> => {
  if (!prompt?.trim()) {
    return errAsync(new PromptExecutionError("Prompt text is empty"));
  }

  const outputSection = buildOutputItemsSection(outputItems, outputDir);
  const effectiveInput = outputSection ? `${inputContent}\n${outputSection}` : inputContent;
  const effectiveAllowedTools = [...new Set([...(allowedTools ?? []), ...(extraTools ?? [])])];

  return ResultAsync.fromPromise(
    (async () => {
      const systemPrompt = `${buildSystemPrompt({ prompt, runtimeContext })}\n${USER_ACTION_SECTION}`;
      const raw = await runAgent({
        agent,
        systemPrompt,
        userPrompt: effectiveInput,
        inputPath,
        jobId,
        agentId: PROMPT_AGENT_ID,
        allowedTools: effectiveAllowedTools,
        onProgress,
        logPrefix: "[LLM] runPrompt",
        apiKey,
        model,
        githubToken,
        ssh,
        getMcpConnectorInjection,
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
