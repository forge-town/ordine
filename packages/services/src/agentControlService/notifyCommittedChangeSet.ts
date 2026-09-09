import { ResultAsync } from "neverthrow";
import { logger } from "@repo/logger";
import type { AgentControlRunEventPort } from "./createAgentControlService";
import type { AgentControlEvent } from "@repo/schemas";
import { canAppendControlRunEvent } from "./controlRunEvent";

/** The committed Change Set is authoritative; notification cannot undo its transaction. */
export const notifyCommittedChangeSet = async (
  events: AgentControlRunEventPort | undefined,
  runId: string | null,
  payload: Record<string, unknown> & { type: AgentControlEvent["type"] },
  emit: () => Promise<void>,
) => {
  if (!events || !runId) return;
  await ResultAsync.fromPromise(
    (async () => {
      const run = await events.getRun(runId);
      if (!canAppendControlRunEvent(run)) return;
      await emit();
    })(),
    () => "Change Set notification unavailable",
  ).match(
    () => undefined,
    () =>
      logger.warn(
        { changeSetId: payload.changeSetId },
        "Committed Change Set notification unavailable; reload its persisted state",
      ),
  );
};
