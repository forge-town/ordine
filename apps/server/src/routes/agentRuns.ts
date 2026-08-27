import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  AgentRunActivityTelemetrySchema,
  type AgentRunEventEnvelope,
  type AgentRunStatus,
} from "@repo/schemas";
import { agentApiAuthMiddleware } from "../integrations/auth";
import { agentRunsService } from "../services.js";

const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
const afterSchema = z.coerce.number().int().nonnegative();
const limitSchema = z.coerce.number().int().min(1).max(500);

const encodeEvent = (envelope: AgentRunEventEnvelope): Uint8Array =>
  new TextEncoder().encode(
    `id: ${envelope.sequence}\nevent: runtime_event\ndata: ${JSON.stringify(envelope)}\n\n`,
  );

export const agentRunsRoutes = new Hono();

agentRunsRoutes.use("*", agentApiAuthMiddleware);

agentRunsRoutes.get("/:id", async (context) => {
  const run = await agentRunsService.getById(context.req.param("id"));
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);

  return context.json(run);
});

agentRunsRoutes.get("/:id/events", async (context) => {
  const runId = context.req.param("id");
  const run = await agentRunsService.getById(runId);
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);
  const rawAfter = context.req.query("after") ?? context.req.header("Last-Event-ID") ?? "0";
  const parsedAfter = afterSchema.safeParse(rawAfter);
  if (!parsedAfter.success) {
    return context.json({ code: "INVALID_SEQUENCE", error: "Invalid event sequence" }, 400);
  }

  const acceptsJson = (context.req.header("Accept") ?? "")
    .split(",")
    .some((value) => value.trim().toLowerCase().startsWith("application/json"));
  if (acceptsJson) {
    const rawLimit = context.req.query("limit") ?? "200";
    const parsedLimit = limitSchema.safeParse(rawLimit);
    if (!parsedLimit.success) {
      return context.json({ code: "INVALID_LIMIT", error: "Invalid event page limit" }, 400);
    }
    const events = await agentRunsService.getEvents(runId, parsedAfter.data, parsedLimit.data);
    const lastEvent = events.at(-1);
    const terminal =
      Boolean(lastEvent?.event.type === "terminal") || TERMINAL_STATUSES.has(run.status);

    return context.json({
      events,
      nextSequence: lastEvent?.sequence ?? parsedAfter.data,
      terminal,
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const state = {
        closed: false,
        replaying: true,
        lastSequence: parsedAfter.data,
        pending: new Map<number, AgentRunEventEnvelope>(),
        heartbeat: undefined as ReturnType<typeof setInterval> | undefined,
        databasePoll: undefined as ReturnType<typeof setInterval> | undefined,
        databasePollInFlight: false,
        unsubscribe: undefined as (() => void) | undefined,
      };
      const close = () => {
        if (state.closed) return;
        state.closed = true;
        if (state.heartbeat) clearInterval(state.heartbeat);
        if (state.databasePoll) clearInterval(state.databasePoll);
        state.unsubscribe?.();
        controller.close();
      };
      const send = (envelope: AgentRunEventEnvelope) => {
        if (state.closed || envelope.sequence <= state.lastSequence) return;
        state.lastSequence = envelope.sequence;
        controller.enqueue(encodeEvent(envelope));
        if (envelope.event.type === "terminal") close();
      };
      state.unsubscribe = agentRunsService.subscribe(runId, (envelope) => {
        if (state.replaying) {
          state.pending.set(envelope.sequence, envelope);

          return;
        }
        send(envelope);
      });
      const replay = await agentRunsService.getEvents(runId, parsedAfter.data);
      for (const envelope of replay) send(envelope);
      while (!state.closed && state.pending.size > 0) {
        const pending = [...state.pending.values()].sort(
          (left, right) => left.sequence - right.sequence,
        );
        state.pending.clear();
        for (const envelope of pending) send(envelope);
      }
      state.replaying = false;
      if (state.closed) return;
      const currentRun = await agentRunsService.getById(runId);
      if (!currentRun || TERMINAL_STATUSES.has(currentRun.status)) {
        close();

        return;
      }
      state.heartbeat = setInterval(() => {
        if (!state.closed) controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
      }, 15_000);
      // Pipeline runs may execute in the desktop app process while this API is
      // served by the sidecar. The database is the cross-process event bus of
      // record; local subscriptions remain the low-latency fast path.
      state.databasePoll = setInterval(async () => {
        if (state.closed || state.databasePollInFlight) return;
        state.databasePollInFlight = true;
        const persisted = await ResultAsync.fromPromise(
          agentRunsService.getEvents(runId, state.lastSequence),
          (cause) => cause,
        );
        persisted.match(
          (events) => {
            for (const envelope of events) send(envelope);
          },
          // End this response so the client can reconnect from lastSequence.
          close,
        );
        state.databasePollInFlight = false;
      }, 250);
      context.req.raw.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "X-Accel-Buffering": "no",
    },
  });
});

agentRunsRoutes.post("/:id/cancel", async (context) => {
  const run = await agentRunsService.getById(context.req.param("id"));
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);

  return context.json(await agentRunsService.cancel(run.id));
});

agentRunsRoutes.post("/:id/activity/telemetry", async (context) => {
  const run = await agentRunsService.getById(context.req.param("id"));
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);
  const parsed = AgentRunActivityTelemetrySchema.safeParse(await context.req.json());
  if (!parsed.success) {
    return context.json(
      { code: "INVALID_ACTIVITY_TELEMETRY", error: "Invalid activity telemetry" },
      400,
    );
  }

  return context.json(await agentRunsService.recordActivityTelemetry(run.id, parsed.data));
});
