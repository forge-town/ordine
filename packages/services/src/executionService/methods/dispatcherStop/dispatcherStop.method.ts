import {
  executionFailure,
  executionServiceResult,
  ExecutionServiceFailure,
} from "../../helpers/serviceResult";

import type { ExecutionDispatcherBindings } from "../../contracts";
export const createDispatcherStopMethod =
  (serviceBindings: Pick<ExecutionDispatcherBindings, "state" | "deps" | "active">) =>
  (timeoutMs = 30_000) =>
    executionServiceResult(async () => {
      serviceBindings.state.accepting = false;
      if (serviceBindings.state.timer) clearInterval(serviceBindings.state.timer);
      await serviceBindings.state.tick;
      const owned = await serviceBindings.deps.jobs.listJobs(serviceBindings.deps.principal);
      for (const job of owned) {
        if (job.state === "queued")
          await serviceBindings.deps.jobs.requestControl(
            serviceBindings.deps.principal,
            job.id,
            "cancel",
          );
      }
      for (const job of serviceBindings.active.values()) job.controller.abort();
      const timer: { id?: ReturnType<typeof setTimeout> } = {};
      const timed = new Promise<false>((resolve) => {
        timer.id = setTimeout(() => resolve(false), timeoutMs);
      });
      const settled = await Promise.race([
        Promise.all([...serviceBindings.active.values()].map((job) => job.task)).then(() => true),
        timed,
      ]);
      if (timer.id) clearTimeout(timer.id);
      if (!settled)
        executionFailure(
          "EXECUTION_SHUTDOWN_INCOMPLETE",
          "Some execution processes did not confirm shutdown",
          undefined,
          "execution",
        );
      if (serviceBindings.state.lastError && serviceBindings.active.size > 0)
        throw new ExecutionServiceFailure(serviceBindings.state.lastError);
    });
