import type { RuntimeEvent } from "@repo/schemas";
import type { ResultAsync } from "neverthrow";
import type { McpConnectorInjection } from "../mcp";
import { runConfiguredAcpAgent } from "../runtime/runConfiguredAcpAgent";

export type RunHermesOptions = {
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  model?: string;
  allowedTools?: readonly string[];
  timeoutMs?: number;
  signal?: AbortSignal;
  connectorInjection?: McpConnectorInjection;
  resumeSessionId?: string;
  onProgress?: (line: string) => Promise<void> | void;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
};

export const getHermesBin = (): string => process.env.HERMES_BIN ?? "hermes";

export const runHermes = (options: RunHermesOptions): ResultAsync<string, Error> =>
  runConfiguredAcpAgent(
    {
      runtime: "hermes",
      command: getHermesBin(),
      args: ["acp", "--accept-hooks"],
    },
    options,
  );
