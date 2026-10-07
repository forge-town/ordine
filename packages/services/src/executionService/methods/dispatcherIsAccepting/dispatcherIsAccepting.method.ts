import type { ExecutionDispatcherBindings } from "../../contracts";
export const createDispatcherIsAcceptingMethod =
  (serviceBindings: Pick<ExecutionDispatcherBindings, "state">) => () =>
    serviceBindings.state.accepting;
