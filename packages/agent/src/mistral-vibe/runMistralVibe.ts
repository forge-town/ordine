import type { RuntimeEvent } from "@repo/schemas";
import type { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runConfiguredAcpAgent } from "../runtime/runConfiguredAcpAgent";

export type RunMistralVibeOptions = {
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

export const runMistralVibe = (options: RunMistralVibeOptions): ResultAsync<string, Error> =>
  runConfiguredAcpAgent(
    {
      runtime: "mistral-vibe",
      command: process.env.VIBE_BIN ?? "vibe-acp",
      args: [],
    },
    options,
  );
