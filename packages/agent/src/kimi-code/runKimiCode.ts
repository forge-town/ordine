import type { RuntimeEvent } from "@repo/schemas";
import type { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runConfiguredAcpAgent } from "../runtime/runConfiguredAcpAgent";

export type RunKimiCodeOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  connectorInjection?: McpConnectorInjection;
  resumeSessionId?: string;
  onProgress?: (line: string) => Promise<void> | void;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

export const runKimiCode = (options: RunKimiCodeOptions): ResultAsync<string, Error> =>
  runConfiguredAcpAgent(
    {
      runtime: "kimi-code",
      command: process.env.KIMI_BIN ?? "kimi",
      args: ["acp"],
    },
    options,
  );
