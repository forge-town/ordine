import { RuntimeEventSchema, type AgentRuntime, type RuntimeEvent } from "@repo/schemas";

type WithoutRuntimeEventBase<T> = T extends RuntimeEvent
  ? Omit<T, "runtime" | "timestamp" | "sequence">
  : never;

export type RuntimeEventPayload = WithoutRuntimeEventBase<RuntimeEvent>;

export const createRuntimeEventEmitter = ({
  runtime,
  now = () => new Date(),
  onEvent,
}: {
  runtime: AgentRuntime;
  now?: () => Date;
  onEvent?: (event: RuntimeEvent) => Promise<void> | void;
}) => {
  const state = { sequence: 0, delivery: Promise.resolve() };

  const emit = (payload: RuntimeEventPayload): RuntimeEvent => {
    const event = RuntimeEventSchema.parse({
      ...payload,
      runtime,
      timestamp: now().toISOString(),
      sequence: state.sequence,
    });
    state.sequence += 1;
    if (onEvent) {
      state.delivery = state.delivery
        .then(() => onEvent(event))
        .then(
          () => undefined,
          () => undefined,
        );
    }

    return event;
  };

  return {
    emit,
    delivered: () => state.delivery,
  };
};
