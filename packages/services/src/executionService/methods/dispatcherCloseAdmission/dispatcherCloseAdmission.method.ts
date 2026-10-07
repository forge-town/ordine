import type { ExecutionDispatcherBindings } from "../../contracts";
export const createDispatcherCloseAdmissionMethod =
  (serviceBindings: Pick<ExecutionDispatcherBindings, "state">) => () => {
    serviceBindings.state.accepting = false;
  };
