import type {
  AgentRuntime,
  AgentRuntimeConnection,
  RuntimeModel,
  SshConnection,
} from "@repo/schemas";
import type { CapabilityAssignmentAgentTarget } from "./schemas";

export type AssignmentRuntimeRecord = {
  id: string;
  type: AgentRuntime;
  connection: AgentRuntimeConnection;
};

const runtimeModels = (runtime: AssignmentRuntimeRecord): RuntimeModel[] =>
  runtime.connection.mode === "local" ? (runtime.connection.models ?? []) : [];

export const deriveCapabilityAssignmentAgentTargets = (
  runtimes: AssignmentRuntimeRecord[],
): CapabilityAssignmentAgentTarget[] => {
  const modelsByAgent = new Map<AgentRuntime, Set<string>>();
  for (const runtime of runtimes) {
    const models = modelsByAgent.get(runtime.type) ?? new Set<string>();
    runtimeModels(runtime).forEach((model) => models.add(model.id));
    if (models.size > 0) modelsByAgent.set(runtime.type, models);
  }

  return [...modelsByAgent.entries()]
    .map(([agent, models]) => ({ agent, models: [...models].sort() }))
    .sort((left, right) => left.agent.localeCompare(right.agent));
};

export type ResolvedAssignmentOrchestrator = {
  runtime: AssignmentRuntimeRecord;
  model: string;
  source: "session" | "default";
  ssh?: SshConnection;
};

export const resolveAssignmentOrchestrator = (input: {
  runtimes: AssignmentRuntimeRecord[];
  requestedRuntimeId?: string;
  requestedRuntimeType?: AgentRuntime;
  requestedModel?: string;
  defaultRuntime?: AgentRuntime | null;
  defaultModel?: string | null;
}): ResolvedAssignmentOrchestrator | null => {
  const usableRuntimes = input.runtimes.filter((runtime) => runtimeModels(runtime).length > 0);
  const requestedById = input.requestedRuntimeId
    ? usableRuntimes.find((runtime) => runtime.id === input.requestedRuntimeId)
    : undefined;
  const requestedByType = input.requestedRuntimeType
    ? usableRuntimes.find((runtime) => runtime.type === input.requestedRuntimeType)
    : undefined;
  const defaultRuntime = input.defaultRuntime
    ? usableRuntimes.find((runtime) => runtime.type === input.defaultRuntime)
    : undefined;
  const runtime = requestedById ?? requestedByType ?? defaultRuntime ?? usableRuntimes[0];
  if (!runtime) return null;

  const models = runtimeModels(runtime);
  const selectedFromSession = Boolean(requestedById || requestedByType);
  const model =
    (selectedFromSession && input.requestedModel
      ? models.find((candidate) => candidate.id === input.requestedModel)
      : undefined) ??
    (input.defaultModel
      ? models.find((candidate) => candidate.id === input.defaultModel)
      : undefined) ??
    models.find((candidate) => candidate.isDefault) ??
    models[0];
  if (!model) return null;

  return {
    runtime,
    model: model.id,
    source: selectedFromSession ? "session" : "default",
    ...(runtime.connection.mode === "ssh" ? { ssh: runtime.connection } : {}),
  };
};
