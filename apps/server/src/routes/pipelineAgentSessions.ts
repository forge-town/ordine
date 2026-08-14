import { Hono, type Context } from "hono";
import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  PipelineAgentEntrypointSchema,
  PipelineGraphSnapshotSchema,
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
  snapshot: PipelineGraphSnapshotSchema.optional(),
});

const appendMessageBodySchema = z.object({
  role: PipelineAgentMessageRoleSchema,
  kind: PipelineAgentMessageKindSchema,
  content: z.string().min(1),
});

const approveProposalBodySchema = z.object({
  proposalId: z.string().min(1),
});

const runtimeSelectionBodySchema = z.object({
  runtimeId: z.string().optional(),
});

const encodeEvent = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const PIPELINE_AGENT_MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const parseJsonBody = (c: Context) =>
  ResultAsync.fromPromise(c.req.json(), (error) =>
    error instanceof Error ? error : new Error(String(error)),
  );

const parseFormData = (c: Context) =>
  ResultAsync.fromPromise(c.req.formData(), (error) =>
    error instanceof Error ? error : new Error(String(error)),
  );

const parseOptionalJsonBody = (c: Context) =>
  ResultAsync.fromPromise(
    (async () => {
      const body = await c.req.text();
      if (body.trim().length === 0) {
        return {};
      }

      return JSON.parse(body) as unknown;
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );

const serviceErrorStatus = (error: Error) => {
  const explicitCode = (error as Error & { code?: string }).code;
  if (explicitCode === "PIPELINE_AGENT_RUNTIME_NOT_FOUND") {
    return 409;
  }
  const message = error.message.toLowerCase();
  if (message.includes("not found")) {
    return 404;
  }
  if (
    message.includes("cannot be approved") ||
    message.includes("cannot be removed") ||
    message.includes("does not belong") ||
    message.includes("does not match") ||
    message.includes("does not have an approved proposal") ||
    message.includes("not a generate session") ||
    message.includes("not ready") ||
    message.includes("approved proposal")
  ) {
    return 409;
  }

  return 500;
};

const serviceErrorCode = (error: Error) => {
  const explicitCode = (error as Error & { code?: string }).code;
  if (
    explicitCode === "PIPELINE_AGENT_CANCELLED" ||
    explicitCode === "PIPELINE_AGENT_RUNTIME_NOT_FOUND"
  ) {
    return explicitCode;
  }

  const message = error.message.toLowerCase();
  if (message.includes("session") && message.includes("not found")) {
    return "PIPELINE_AGENT_SESSION_NOT_FOUND";
  }
  if (message.includes("attachment") && message.includes("not found")) {
    return "PIPELINE_AGENT_ATTACHMENT_NOT_FOUND";
  }
  if (message.includes("attachment") && message.includes("cannot be removed")) {
    return "PIPELINE_AGENT_ATTACHMENT_STATE_CONFLICT";
  }
  if (message.includes("proposal") || message.includes("not ready")) {
    return "PIPELINE_AGENT_PROPOSAL_STATE_CONFLICT";
  }
  if (message.includes("pipeline structure") || message.includes("invalid json")) {
    return "PIPELINE_AGENT_INVALID_STRUCTURE";
  }

  return "PIPELINE_AGENT_REQUEST_FAILED";
};

const serviceErrorPayload = (error: Error) => ({
  code: serviceErrorCode(error),
  error: error.message,
});

pipelineAgentSessionsRoutes.post("/", async (c) => {
  const bodyResult = await parseJsonBody(c);
  if (bodyResult.isErr()) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const parsed = createSessionBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
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
    return c.json({ code: "PIPELINE_AGENT_SESSION_NOT_FOUND", error: "Session not found" }, 404);
  }

  return c.json(session);
});

pipelineAgentSessionsRoutes.post("/:id/messages", async (c) => {
  const bodyResult = await parseJsonBody(c);
  if (bodyResult.isErr()) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const parsed = appendMessageBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const message = await pipelineAgentSessionsService.appendMessage(c.req.param("id"), parsed.data);

  return c.json(message, 201);
});

pipelineAgentSessionsRoutes.post("/:id/attachments", async (c) => {
  const formDataResult = await parseFormData(c);
  if (formDataResult.isErr()) {
    return c.json({ code: "INVALID_ATTACHMENT", error: "Invalid attachment upload" }, 400);
  }

  const file = formDataResult.value.get("file");
  if (!(file instanceof File)) {
    return c.json({ code: "INVALID_ATTACHMENT", error: "Invalid attachment upload" }, 400);
  }
  if (file.size > PIPELINE_AGENT_MAX_ATTACHMENT_BYTES) {
    return c.json({ code: "ATTACHMENT_TOO_LARGE", error: "Attachment is too large" }, 413);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const runtimeId = formDataResult.value.get("runtimeId");
  const ingestResult = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.ingestAttachment(c.req.param("id"), {
      bytes,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      ...(typeof runtimeId === "string" && runtimeId.trim().length > 0
        ? { runtimeId: runtimeId.trim() }
        : {}),
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (ingestResult.isErr()) {
    return c.json(
      {
        code: "PIPELINE_AGENT_ATTACHMENT_UPLOAD_FAILED",
        error: ingestResult.error.message,
      },
      serviceErrorStatus(ingestResult.error),
    );
  }

  return c.json(ingestResult.value, 201);
});

pipelineAgentSessionsRoutes.delete("/:id/attachments/:attachmentId", async (c) => {
  const result = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.removeAttachment(c.req.param("id"), c.req.param("attachmentId")),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (result.isErr()) {
    return c.json(serviceErrorPayload(result.error), serviceErrorStatus(result.error));
  }

  return c.body(null, 204);
});

pipelineAgentSessionsRoutes.post("/:id/plan", async (c) => {
  const bodyResult = await parseOptionalJsonBody(c);
  if (bodyResult.isErr()) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const parsed = runtimeSelectionBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const stream = new ReadableStream({
    start: async (controller) => {
      const encoder = new TextEncoder();
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(encodeEvent(event, data)));
      };

      send("phase", { phase: "planning" });

      const planResult = await ResultAsync.fromPromise(
        pipelineAgentSessionsService.planSession(c.req.param("id"), {
          runtimeId: parsed.data.runtimeId,
          onProgress: (message) => {
            send("progress", { message });
          },
          onAssistantChunk: (text) => {
            send("assistant_chunk", { text });
          },
        }),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      );

      if (planResult.isErr()) {
        send("error", {
          code: serviceErrorCode(planResult.error),
          message: "Pipeline agent request failed",
        });
        controller.close();

        return;
      }

      if (planResult.value.type === "question") {
        send("question", planResult.value);
      } else {
        send("proposal_ready", planResult.value);
      }

      send("done", { status: "ok" });
      controller.close();
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
  const bodyResult = await parseJsonBody(c);
  if (bodyResult.isErr()) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const parsed = approveProposalBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const approveResult = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.approveProposal(c.req.param("id"), parsed.data.proposalId),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (approveResult.isErr()) {
    return c.json(
      serviceErrorPayload(approveResult.error),
      serviceErrorStatus(approveResult.error),
    );
  }

  return c.body(null, 204);
});

pipelineAgentSessionsRoutes.post("/:id/supersede", async (c) => {
  const bodyResult = await parseJsonBody(c);
  if (bodyResult.isErr()) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const parsed = approveProposalBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const supersedeResult = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.supersedeProposal(c.req.param("id"), parsed.data.proposalId),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (supersedeResult.isErr()) {
    return c.json(
      serviceErrorPayload(supersedeResult.error),
      serviceErrorStatus(supersedeResult.error),
    );
  }

  return c.body(null, 204);
});

pipelineAgentSessionsRoutes.post("/:id/cancel", async (c) => {
  const cancelResult = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.cancelSession(c.req.param("id")),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (cancelResult.isErr()) {
    return c.json(serviceErrorPayload(cancelResult.error), serviceErrorStatus(cancelResult.error));
  }

  return c.body(null, 204);
});

pipelineAgentSessionsRoutes.post("/:id/generate", async (c) => {
  const bodyResult = await parseOptionalJsonBody(c);
  if (bodyResult.isErr()) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const parsed = runtimeSelectionBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return c.json({ code: "INVALID_REQUEST", error: "Invalid request body" }, 400);
  }

  const result = await ResultAsync.fromPromise(
    pipelineAgentSessionsService.generatePipelineFromApprovedProposal(
      c.req.param("id"),
      parsed.data.runtimeId ? { runtimeId: parsed.data.runtimeId } : undefined,
    ),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
  if (result.isErr()) {
    return c.json(serviceErrorPayload(result.error), serviceErrorStatus(result.error));
  }

  return c.json({ pipelineId: result.value.pipeline.id });
});
