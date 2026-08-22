import { RuntimeEventSchema, type AgentRuntime, type RuntimeEvent } from "@repo/schemas";
import type { AgentRunOptions, DriverResult } from "./types";

type DriverFn = (opts: AgentRunOptions) => Promise<DriverResult>;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Adapts legacy runtime callbacks to the shared RuntimeEvent contract while
 * each native protocol adapter is migrated independently.
 */
export const withLegacyRuntimeEvents =
  (runtime: AgentRuntime, driver: DriverFn): DriverFn =>
  async (opts) => {
    const state = { sequence: 0, emittedText: false };
    const emit = async (payload: Record<string, unknown> & { type: string }): Promise<void> => {
      const event: RuntimeEvent = RuntimeEventSchema.parse({
        ...payload,
        runtime,
        timestamp: new Date().toISOString(),
        sequence: state.sequence,
      });
      state.sequence += 1;
      if (!opts.onRuntimeEvent) return;
      await Promise.resolve(opts.onRuntimeEvent(event)).then(
        () => undefined,
        () => undefined,
      );
    };

    await emit({ type: "status", phase: "starting", message: `Starting ${runtime}` });
    const wrapped: AgentRunOptions = {
      ...opts,
      onProgress: async (message) => {
        await emit({
          type: "diagnostic",
          level: "info",
          code: "RUNTIME_PROGRESS",
          message,
        });
        await opts.onProgress?.(message);
      },
      onTextDelta: async (text) => {
        state.emittedText = true;
        await emit({ type: runtime === "claude-code" ? "text_delta" : "message", text });
        await opts.onTextDelta?.(text);
      },
    };

    return driver(wrapped).then(
      async (result) => {
        if (!state.emittedText && result.text) {
          await emit({ type: "message", text: result.text });
        }
        await emit({
          type: "terminal",
          status: "completed",
          exitCode: null,
          signal: null,
          resultText: result.text,
        });

        return result;
      },
      async (error) => {
        await emit({
          type: "diagnostic",
          level: "error",
          code: "RUNTIME_FAILED",
          message: errorMessage(error),
        });
        await emit({
          type: "terminal",
          status: "failed",
          exitCode: null,
          signal: null,
        });
        throw error;
      },
    );
  };
