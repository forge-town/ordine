import type { RuntimeEvent } from "@repo/schemas";
import type { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runConfiguredAcpAgent } from "../runtime/runConfiguredAcpAgent";

export type RunTraeOptions = {
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

export const runTrae = (options: RunTraeOptions): ResultAsync<string, Error> =>
  runConfiguredAcpAgent(
    {
      runtime: "trae",
      command: process.env.TRAE_BIN ?? "traecli",
      args: ["acp", "serve", "--yolo"],
    },
    options,
  );
