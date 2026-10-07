import type { ExecutionDispatcherBindings } from "../../contracts";
export const createDispatcherStatusMethod =
  (serviceBindings: Pick<ExecutionDispatcherBindings, "state" | "active">) => () => ({
    accepting: serviceBindings.state.accepting,
    activeJobs: [...serviceBindings.active.keys()],
    lastError: serviceBindings.state.lastError,
  });
