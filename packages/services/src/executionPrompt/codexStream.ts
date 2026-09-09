import { Result, ResultAsync, err, ok, type Result as Outcome } from "neverthrow";
import { z } from "zod/v4";
import { RuntimeEventSchema, type ExecutionError, type RuntimeEvent } from "@repo/schemas";
import type { ExecutionPromptLimits } from "./types";
import { ExecutionPromptError, parsePromptJson, promptError } from "./errors";

type Payload<T = RuntimeEvent> = T extends RuntimeEvent
  ? Omit<T, "runtime" | "timestamp" | "sequence">
  : never;
const ItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["agent_message", "reasoning", "error"]),
  text: z.string().optional(),
  message: z.string().optional(),
});
const EventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("thread.started"), thread_id: z.string().min(1) }),
  z.object({ type: z.literal("turn.started") }),
  z.object({ type: z.enum(["item.started", "item.updated", "item.completed"]), item: ItemSchema }),
  z.object({
    type: z.literal("turn.completed"),
    usage: z.object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
      cached_input_tokens: z.number().int().nonnegative().optional(),
    }),
  }),
  z.object({ type: z.literal("turn.failed"), error: z.object({ message: z.string() }) }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export const createCodexStream = (options: {
  limits: ExecutionPromptLimits;
  onEvent?: (event: RuntimeEvent) => Promise<Outcome<void, ExecutionError>>;
  abort: () => void;
  redact?: (text: string) => string;
}) => {
  const state: {
    sequence: number;
    eventBytes: number;
    delivery: Promise<void>;
    error?: ExecutionError;
    pending: string;
    session?: string;
    started: boolean;
    completed: boolean;
    finalText?: string;
    modelOutput: boolean;
  } = {
    sequence: 0,
    eventBytes: 0,
    delivery: Promise.resolve(),
    pending: "",
    started: false,
    completed: false,
    modelOutput: false,
  };
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const emit = (payload: Payload) => {
    if (state.error) return;
    const event = RuntimeEventSchema.parse({
      ...payload,
      runtime: "codex",
      timestamp: new Date().toISOString(),
      sequence: state.sequence++,
    });
    const size = Buffer.byteLength(JSON.stringify(event));
    state.eventBytes += size;
    if (
      state.sequence > options.limits.maxEvents ||
      size > options.limits.maxEventBytes ||
      state.eventBytes > options.limits.maxStreamBytes
    )
      throw new ExecutionPromptError(
        "PROMPT_EVENT_LIMIT",
        "Runtime event persistence limits were exceeded.",
      );
    if (!options.onEvent) return;
    state.delivery = state.delivery.then(async () => {
      if (state.error) return;
      const timer: { value?: ReturnType<typeof setTimeout> } = {};
      const delivered = await ResultAsync.fromPromise(
        Promise.race([
          Promise.resolve().then(() => options.onEvent!(event)),
          new Promise<Outcome<void, ExecutionError>>((resolve) => {
            timer.value = setTimeout(
              () =>
                resolve(
                  err(
                    promptError(
                      new ExecutionPromptError(
                        "PROMPT_EVENT_TIMEOUT",
                        "Runtime event persistence timed out.",
                      ),
                    ),
                  ),
                ),
              options.limits.callbackTimeoutMs,
            );
          }),
        ]),
        () =>
          promptError(
            new ExecutionPromptError("PROMPT_EVENT_FAILED", "Runtime event persistence failed."),
          ),
      ).andThen((result) => result);
      if (timer.value) clearTimeout(timer.value);
      if (delivered.isErr()) {
        state.error = delivered.error;
        options.abort();
      }
    });
  };
  const line = (text: string) => {
    if (!text.trim()) return;
    if (Buffer.byteLength(text) > options.limits.maxEventBytes)
      throw new ExecutionPromptError(
        "PROMPT_EVENT_LIMIT",
        "Runtime JSON event exceeds the byte limit.",
      );
    const raw = parsePromptJson(text);
    const parsed = EventSchema.safeParse(raw);
    if (!parsed.success) {
      const shape = z
        .object({
          type: z.string().regex(/^[a-z_.]{1,80}$/u),
          item: z.object({ type: z.string().regex(/^[a-z_.]{1,80}$/u) }).optional(),
        })
        .safeParse(raw);
      throw new ExecutionPromptError(
        "PROMPT_STREAM_UNSUPPORTED",
        `Runtime emitted an unsupported event or attempted a tool call${shape.success ? `: ${shape.data.type}/${shape.data.item?.type ?? "none"}` : "."}`,
      );
    }
    const event = parsed.data;
    if ("item" in event && event.item.text) state.modelOutput = true;
    if ("item" in event && event.item.type === "error") {
      const message =
        options.redact?.(event.item.message ?? "Codex reported an item error.") ??
        event.item.message ??
        "Codex reported an item error.";
      if (message.startsWith("Under-development features enabled:")) {
        emit({
          type: "diagnostic",
          level: "warning",
          code: "CODEX_FEATURE_WARNING",
          message: "Codex reports that configured isolation features are under development.",
        });

        return;
      }
      throw new ExecutionPromptError(
        "CODEX_ITEM_ERROR",
        message.length <= 1000
          ? message.replaceAll(/[A-Za-z0-9_-]{24,}/gu, "[redacted]")
          : "Codex reported an item error.",
      );
    }
    if (state.completed)
      throw new ExecutionPromptError(
        "PROMPT_STREAM_INVALID",
        "Runtime emitted events after final completion.",
      );
    if (event.type === "error" || event.type === "turn.failed") {
      const rawDetail = event.type === "error" ? event.message : event.error.message;
      const detail = options.redact?.(rawDetail) ?? rawDetail;
      const safeDetail =
        detail.length <= 1000
          ? detail.replaceAll(/[A-Za-z0-9_-]{24,}/gu, "[redacted]")
          : "Codex reported a runtime failure.";
      emit({
        type: "diagnostic",
        level: "error",
        code: "CODEX_TURN_FAILED",
        message: safeDetail,
      });
      throw new ExecutionPromptError("CODEX_TURN_FAILED", safeDetail);
    }
    if (event.type === "thread.started") {
      if (state.session)
        throw new ExecutionPromptError(
          "PROMPT_STREAM_INVALID",
          "Runtime started more than one session.",
        );
      state.session = event.thread_id;
      emit({ type: "session", phase: "created", id: event.thread_id });
    } else if (event.type === "turn.started") {
      if (!state.session || state.started)
        throw new ExecutionPromptError(
          "PROMPT_STREAM_INVALID",
          "Runtime turn sequence is invalid.",
        );
      state.started = true;
      emit({ type: "status", phase: "running" });
    } else {
      if (!state.started)
        throw new ExecutionPromptError(
          "PROMPT_STREAM_INVALID",
          "Runtime output preceded its turn.",
        );
      if (event.type === "turn.completed") {
        state.completed = true;
        emit({
          type: "usage",
          inputTokens: event.usage.input_tokens,
          outputTokens: event.usage.output_tokens,
          cachedInputTokens: event.usage.cached_input_tokens,
        });
      } else if (event.type === "item.completed") {
        if (event.item.text === undefined)
          throw new ExecutionPromptError(
            "PROMPT_STREAM_INVALID",
            "Completed text item has no text.",
          );
        if (event.item.type === "agent_message") {
          state.finalText = event.item.text;
          emit({ type: "message", text: event.item.text });
        }
      }
    }
  };
  const consume = (chunk?: Buffer) =>
    Result.fromThrowable(
      () => {
        state.pending += chunk ? decoder.decode(chunk, { stream: true }) : decoder.decode();
        const lines = state.pending.split("\n");
        state.pending = lines.pop()!;
        for (const text of lines) line(text);
        if (Buffer.byteLength(state.pending) > options.limits.maxEventBytes)
          throw new ExecutionPromptError(
            "PROMPT_EVENT_LIMIT",
            "Runtime JSON line exceeds the byte limit.",
          );
        if (!chunk && state.pending) {
          line(state.pending);
          state.pending = "";
        }
      },
      (error) =>
        error instanceof ExecutionPromptError
          ? promptError(error)
          : promptError(
              new ExecutionPromptError(
                "PROMPT_STREAM_INVALID",
                "Runtime stream is not valid UTF-8 JSONL.",
              ),
            ),
    )();

  return {
    hasFirstOutput: () => state.modelOutput,
    consume,
    emit,
    settle: async () => {
      await state.delivery;
      if (state.error) return err(state.error);

      return ok(undefined);
    },
    completion: () => {
      const consumed = consume();
      if (consumed.isErr())
        throw new ExecutionPromptError(
          consumed.error.code,
          consumed.error.message,
          consumed.error.stage,
        );
      if (!state.completed || state.finalText === undefined)
        throw new ExecutionPromptError(
          "PROMPT_COMPLETION_MISSING",
          "Codex did not provide a completed final response.",
        );

      return { text: state.finalText, sessionId: state.session };
    },
  };
};
