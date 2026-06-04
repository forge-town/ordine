import { Hono } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  PipelineAgentEntrypointSchema,
  PipelineAgentMessageKindSchema,
  PipelineAgentMessageRoleSchema,
  PipelineAgentModeSchema,
} from "@repo/schemas";
import { pipelineAgentSessionsService } from "../services.js";

export const pipelineAgentSessionsRoutes = new Hono();

const createSessionBodySchema = z.object({
  entrypoint: PipelineAgentEntrypointSchema,
  mode: PipelineAgentModeSchema,
  pipelineId: z.string().optional(),
  snapshot: z.unknown().optional(),
});

const appendMessageBodySchema = z.object({
  role: PipelineAgentMessageRoleSchema,
  kind: PipelineAgentMessageKindSchema,
  content: z.string().min(1),
});

const approveProposalBodySchema = z.object({
  proposalId: z.string().min(1),
});

const planSessionBodySchema = z.object({
  runtimeId: z.string().optional(),
});

const encodeEvent = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

pipelineAgentSessionsRoutes.post("/", async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const parsed = createSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const session = await pipelineAgentSessionsService.createSession({
    entrypoint: parsed.data.entrypoint,
    mode: parsed.data.mode,
    ...(parsed.data.pipelineId ? { pipelineId: parsed.data.pipelineId } : {}),
    ...(parsed.data.snapshot ? { snapshot: parsed.data.snapshot as never } : {}),
  });

  return c.json(session, 201);
});

pipelineAgentSessionsRoutes.get("/:id", async (c) => {
  const session = await pipelineAgentSessionsService.getSessionById(c.req.param("id"));
  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json(session);
});

pipelineAgentSessionsRoutes.post("/:id/messages", async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const parsed = appendMessageBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const message = await pipelineAgentSessionsService.appendMessage(c.req.param("id"), parsed.data);

  return c.json(message, 201);
});

pipelineAgentSessionsRoutes.post("/:id/attachments", async (c) => {
  const formData = await c.req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return c.json({ error: "Invalid attachment upload" }, 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await pipelineAgentSessionsService.ingestAttachment(c.req.param("id"), {
    bytes,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });

  return c.json(result, 201);
});

pipelineAgentSessionsRoutes.post("/:id/plan", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = planSessionBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  const stream = new ReadableStream({
    start: (controller) => {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      send("phase", { phase: "planning" });

      void pipelineAgentSessionsService
        .planSession(c.req.param("id"), {
          runtimeId: parsed.data.runtimeId,
          onProgress: (message) => {
            send("progress", { message });
            send("assistant_chunk", { text: message });
          },
        })
        .then((result) => {
          if (result.type === "question") {
            send("question", result);
          } else {
            send("proposal_ready", result);
          }

          send("done", { status: "ok" });
          controller.close();
        })
        .catch((error) => {
          send("error", {
            message: error instanceof Error ? error.message : String(error),
          });
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
});

pipelineAgentSessionsRoutes.post("/:id/approve", async (c) => {
  const body = await c.req.json().catch(() => undefined);
  const parsed = approveProposalBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  await pipelineAgentSessionsService.approveProposal(c.req.param("id"), parsed.data.proposalId);

  return c.body(null, 204);
});

pipelineAgentSessionsRoutes.post("/:id/generate", async (c) => {
  const result = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.generatePipelineFromApprovedProposal(c.req.param("id")),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (result.isErr()) {
    return c.json({ error: result.error.message }, 500);
  }

  return c.json({ pipelineId: result.value.pipeline.id });
});
