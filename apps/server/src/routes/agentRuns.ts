import { Hono } from "hono";
import { z } from "zod/v4";
import type { AgentRunEventEnvelope, AgentRunStatus } from "@repo/schemas";
import { agentRunsService } from "../services.js";

const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
const afterSchema = z.coerce.number().int().nonnegative();

const encodeEvent = (envelope: AgentRunEventEnvelope): Uint8Array =>
  new TextEncoder().encode(
    `id: ${envelope.sequence}\nevent: runtime_event\ndata: ${JSON.stringify(envelope)}\n\n`,
  );

export const agentRunsRoutes = new Hono();

agentRunsRoutes.get("/:id", async (context) => {
  const run = await agentRunsService.getById(context.req.param("id"));
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);

  return context.json(run);
});

agentRunsRoutes.get("/:id/events", async (context) => {
  const runId = context.req.param("id");
  const run = await agentRunsService.getById(runId);
  if (!run) return context.json({ code: "AGENT_RUN_NOT_FOUND", error: "Run not found" }, 404);
  const rawAfter =
    context.req.query("after") ?? context.req.header("Last-Event-ID") ?? "0";
  const parsedAfter = afterSchema.safeParse(rawAfter);
  if (!parsedAfter.success) {
    return context.json({ code: "INVALID_SEQUENCE", error: "Invalid event sequence" }, 400);
  }

  const stream = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      const state = {
        closed: false,
        replaying: true,
        lastSequence: parsedAfter.data,
        pending: new Map<number, AgentRunEventEnvelope>(),
        heartbeat: undefined as ReturnType<typeof setInterval> | undefined,
        unsubscribe: undefined as (() => void) | undefined,
      };
      const close = () => {
        if (state.closed) return;
        state.closed = true;
        if (state.heartbeat) clearInterval(state.heartbeat);
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
