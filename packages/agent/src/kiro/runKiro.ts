import type { RuntimeEvent } from "@repo/schemas";
import type { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runConfiguredAcpAgent } from "../runtime/runConfiguredAcpAgent";

export type RunKiroOptions = {
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

export const runKiro = (options: RunKiroOptions): ResultAsync<string, Error> =>
  runConfiguredAcpAgent(
    {
      runtime: "kiro",
      command: process.env.KIRO_BIN ?? "kiro-cli",
      args: ["acp"],
      completePromptOnTurnEnd: true,
    },
    options,
  );
