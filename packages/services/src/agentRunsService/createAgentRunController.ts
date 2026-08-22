import {
  agentEngine,
  type AgentRunController,
  type AgentRunOptions,
  type AgentRunOutcome,
} from "@repo/agent-engine";
import { getLocalAgentRuntimeId, type AgentRunEventEnvelope } from "@repo/schemas";
import type { createAgentRunsService } from "./createAgentRunsService";

type AgentRunsService = ReturnType<typeof createAgentRunsService>;
const PRODUCT_RUNTIMES = new Set(["codex", "claude-code", "opencode"]);

const deliverEvent = async (
  options: AgentRunOptions,
  envelope: AgentRunEventEnvelope,
): Promise<void> => {
  const event = envelope.event;
  await options.onRuntimeEvent?.(event);
  if (event.type === "text_delta" || event.type === "message") {
    await options.onTextDelta?.(event.text);
  } else if (event.type === "status") {
    await options.onProgress?.(event.message ?? event.phase);
  } else if (event.type === "diagnostic") {
    await options.onProgress?.(`${event.code}: ${event.message}`);
  } else if (event.type === "retry") {
    await options.onProgress?.(event.message ?? `retry ${event.phase}`);
  } else if (event.type === "tool_start") {
    await options.onProgress?.(`tool ${event.name}: started`);
  } else if (event.type === "tool_update") {
    await options.onProgress?.(`tool ${event.name ?? event.id}: ${event.status}`);
  } else if (event.type === "tool_result") {
    await options.onProgress?.(`tool ${event.id}: ${event.isError ? "failed" : "completed"}`);
  }
};

export const createAgentRunController =
  (agentRunsService: AgentRunsService): AgentRunController =>
  async (options): Promise<AgentRunOutcome> => {
    if (!PRODUCT_RUNTIMES.has(options.agent) || options.ssh) {
      return agentEngine.runDirect(options);
    }
    const runtimeConfigId = options.runtimeConfigId ?? getLocalAgentRuntimeId(options.agent);
    const started = await agentRunsService.start(
      {
        owner: {
          type: options.jobId ? "job-agent" : "agent-engine",
          id: options.jobId
            ? `${options.jobId}:${options.agentId ?? options.agent}`
            : (options.agentId ?? crypto.randomUUID()),
        },
        runtimeConfigId,
        cwd: options.cwd,
        ...(options.model ? { model: options.model } : {}),
        systemPrompt: options.systemPrompt,
        prompt: options.userPrompt,
        rebuildPrompt: options.rebuildPrompt ?? options.userPrompt,
        ...(options.resumeFromRunId ? { resumeFromRunId: options.resumeFromRunId } : {}),
        permissionMode: options.permissionMode ?? "full-access",
        networkAccess: options.networkAccess ?? true,
        fullAccessConfirmed: options.fullAccessConfirmed ?? true,
        allowedTools: [...(options.allowedTools ?? [])],
      },
      {
        ...(options.apiKey ? { apiKey: options.apiKey } : {}),
        ...(options.attachments ? { attachments: options.attachments } : {}),
        ...(options.connectorInjection ? { connectorInjection: options.connectorInjection } : {}),
        ...(options.getMcpConnectorInjection
          ? { getMcpConnectorInjection: options.getMcpConnectorInjection }
          : {}),
        ...(options.githubToken ? { githubToken: options.githubToken } : {}),
      },
    );
    const state = {
      lastSequence: 0,
      replaying: true,
      pending: new Map<number, AgentRunEventEnvelope>(),
    };
    const forward = async (envelope: AgentRunEventEnvelope) => {
      if (envelope.sequence <= state.lastSequence) return;
      state.lastSequence = envelope.sequence;
      await deliverEvent(options, envelope);
    };
    const unsubscribe = agentRunsService.subscribe(started.runId, (envelope) => {
      if (state.replaying) {
        state.pending.set(envelope.sequence, envelope);

        return;
      }

      return forward(envelope);
    });
    const cancel = () => void agentRunsService.cancel(started.runId);
    options.signal?.addEventListener("abort", cancel, { once: true });
    if (options.signal?.aborted) cancel();
    const execution = (async (): Promise<AgentRunOutcome> => {
      for (const envelope of await agentRunsService.getEvents(started.runId, 0)) {
        await forward(envelope);
      }
      for (const envelope of [...state.pending.values()].sort(
        (left, right) => left.sequence - right.sequence,
      )) {
        await forward(envelope);
      }
      state.pending.clear();
      state.replaying = false;
      const run = await agentRunsService.wait(started.runId);
      for (const envelope of await agentRunsService.getEvents(started.runId, state.lastSequence)) {
        await forward(envelope);
      }
      if (run.status !== "completed") {
        throw new Error(run.errorMessage ?? `${options.agent} run ended with ${run.status}`);
      }

      return {
        text: run.resultText ?? "",
        usage:
          run.usage?.inputTokens === undefined && run.usage?.outputTokens === undefined
            ? null
            : {
                input: run.usage?.inputTokens ?? 0,
                output: run.usage?.outputTokens ?? 0,
              },
      };
    })();

    return execution.finally(() => {
      options.signal?.removeEventListener("abort", cancel);
      unsubscribe();
    });
  };
