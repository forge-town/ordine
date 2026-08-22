import type { RuntimeEvent } from "@repo/schemas";
import type { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runConfiguredAcpAgent } from "../runtime/runConfiguredAcpAgent";

export type RunDeepSeekReasonixOptions = {
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

export const runDeepSeekReasonix = (
  options: RunDeepSeekReasonixOptions,
): ResultAsync<string, Error> =>
  runConfiguredAcpAgent(
    {
      runtime: "deepseek-reasonix",
      command: process.env.REASONIX_BIN ?? "reasonix",
      args: ["acp"],
      mcpEnvFormat: "map",
    },
    options,
  );
