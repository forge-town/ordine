import { ResultAsync } from "neverthrow";
import type { AgentRuntime, RuntimeEvent } from "@repo/schemas";
import type { McpConnectorInjection } from "../mcp";
import { runAcpSession } from "./runAcpSession";

export type ConfiguredAcpAgentOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  connectorInjection?: McpConnectorInjection;
  resumeSessionId?: string;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

export type ConfiguredAcpAgent = {
  runtime: AgentRuntime;
  command: string;
  args: readonly string[];
  env?: NodeJS.ProcessEnv;
  mcpEnvFormat?: "array" | "map";
  completePromptOnTurnEnd?: boolean;
};

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

export const runConfiguredAcpAgent = (
  config: ConfiguredAcpAgent,
  options: ConfiguredAcpAgentOptions,
): ResultAsync<string, Error> =>
  ResultAsync.fromPromise(
    runAcpSession({
      runtime: config.runtime,
      command: config.command,
      args: config.args,
      cwd: options.cwd,
      prompt: options.systemPrompt
        ? `${options.systemPrompt}\n\n${options.userPrompt}`
        : options.userPrompt,
      model: options.model,
      timeoutMs: options.timeoutMs ?? 10 * 60 * 1000,
      signal: options.signal,
      env: config.env,
      mcpServers: options.connectorInjection?.mcpServers,
      mcpEnvFormat: config.mcpEnvFormat,
      resumeSessionId: options.resumeSessionId,
      completePromptOnTurnEnd: config.completePromptOnTurnEnd,
      onEvent: options.onRuntimeEvent,
    }),
    toError,
  ).andThen((result) => result.map((value) => value.text));
