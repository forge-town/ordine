import type {
  AgentControlActor,
  AgentControlAudience,
  AgentControlScope,
  AgentControlToolResult,
} from "@repo/schemas";

export type AgentControlInvocationContext = {
  actor: AgentControlActor;
  audience: AgentControlAudience;
  scopes: ReadonlySet<AgentControlScope>;
  threadId: string | null;
  runId: string | null;
  readonly: boolean;
};

export type AgentControlToolPort = {
  invoke: (
    name: string,
    input: unknown,
    context: AgentControlInvocationContext,
  ) => Promise<AgentControlToolResult>;
};
