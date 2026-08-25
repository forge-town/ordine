import { Hono } from "hono";
import { z } from "zod/v4";
import type { AgentControlScope } from "@repo/schemas";
import { agentApiAuthMiddleware } from "../integrations/auth";
import { getEnv } from "../integrations/env";
import { agentControlService } from "../services.js";
import { validateJson, validationErrorJson } from "./result";

const CallAgentControlToolSchema = z
  .object({
    name: z.string().min(1),
    input: z.unknown().default({}),
    threadId: z.string().min(1).optional(),
  })
  .strict();

const STDIO_SCOPES = new Set<AgentControlScope>([
  "resources:read",
  "resources:write",
  "canvas:read",
  "canvas:draft",
  "execute",
  "irreversible:request",
]);

export const agentControlApiRoutes = new Hono();

agentControlApiRoutes.use("*", agentApiAuthMiddleware);

agentControlApiRoutes.post("/tools/call", async (context) => {
  if (!getEnv().ORDINE_AGENT_CONTROL_ENABLED) {
    return context.json({ error: "ORDINE Agent Control is disabled" }, 503);
  }
  const parsed = await validateJson(context, CallAgentControlToolSchema);
  if (!parsed.success) return validationErrorJson(context);
  const threadId = parsed.data.threadId ?? agentControlService.defaultThreadId("stdio");
  const result = await agentControlService.invoke(parsed.data.name, parsed.data.input, {
    actor: "local-owner",
    audience: "stdio",
    scopes: STDIO_SCOPES,
    threadId,
    runId: null,
    readonly: false,
  });

  return context.json(result, result.status === "failed" ? 422 : 200);
});
