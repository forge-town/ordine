import type { AgentControlInvocationContext } from "@repo/agent-control";

import type { AgentControlServiceBindings } from "../../contracts";
export const createEnsureThreadHelper =
  (serviceBindings: Pick<AgentControlServiceBindings, "threadsDao">) =>
  async (context: AgentControlInvocationContext): Promise<string> => {
    const id = context.threadId ?? `agent-control-${context.audience}-local-owner`;
    const applicationThread = context.audience === "internal-run" && Boolean(context.threadId);
    const existing = await serviceBindings.threadsDao.ensure({
      id,
      title: context.threadId ? "Agent thread" : `${context.audience} Agent Control`,
      entrypoint: applicationThread ? "global-agent-bar" : "agent-control-external",
    });
    if (!existing) throw new Error(`Unable to create or load Agent thread ${id}`);

    return id;
  };
