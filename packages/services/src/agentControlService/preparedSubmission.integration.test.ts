import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import { ok } from "neverthrow";
import * as schema from "@repo/db-schema";
import { AgentControlScopeSchema } from "@repo/schemas";
import { createAgentControlService } from "./createAgentControlService";
import { createAgentThreadsService } from "./createAgentThreadsService";
import { createResourceControl } from "./resourceControl";

const databaseUrl = process.env.ORDINE_PRODUCT_TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("Agent prepared submission", () => {
  it("updates only supplied Operation fields through the real authoring service", async ({
    onTestFinished,
  }) => {
    const url = new URL(databaseUrl!);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("36435");
    expect(url.pathname).toMatch(/^\/ordine_product_ui_[a-z0-9_]+$/u);
    const sql = postgres(databaseUrl!, { max: 1 });
    const id = `patch-check-${randomUUID()}`;
    onTestFinished(async () => {
      await sql`DELETE FROM operations WHERE id = ${id}`;
      await sql.end();
    });
    const resources = createResourceControl(drizzle(sql, { schema }));
    const config = {
      inputs: [],
      outputs: [],
      executor: {
        type: "script",
        language: "javascript",
        command: "console.log('original')",
        outputMode: "text",
      },
    };
    const created = await resources.create("operation", {
      id,
      name: "Partial update verification",
      description: "Keep this description",
      acceptedObjectTypes: ["prompt"],
      config,
    });
    expect(created.isOk(), JSON.stringify(created)).toBe(true);
    const updated = await resources.update("operation", id, {
      config: { ...config, executor: { ...config.executor, command: "console.log('updated')" } },
    });
    expect(updated.isOk(), JSON.stringify(updated)).toBe(true);
    const [record] =
      await sql`SELECT description, accepted_object_types, config FROM operations WHERE id = ${id}`;
    expect(record!.description).toBe("Keep this description");
    expect(record!.accepted_object_types).toEqual(["prompt"]);
    expect(record!.config.executor.command).toBe("console.log('updated')");
    const cleared = await resources.update("operation", id, {
      description: "",
      acceptedObjectTypes: [],
    });
    expect(cleared.isOk()).toBe(true);
    const [explicit] =
      await sql`SELECT description, accepted_object_types, config FROM operations WHERE id = ${id}`;
    expect(explicit!.description).toBe("");
    expect(explicit!.accepted_object_types).toEqual([]);
    expect(explicit!.config.executor.command).toBe("console.log('updated')");
  });
  it("persists one request identity and never creates an old approval or invents a Job", async ({
    onTestFinished,
  }) => {
    const url = new URL(databaseUrl!);
    expect(url.hostname).toBe("127.0.0.1");
    expect(url.port).toBe("36435");
    expect(url.pathname).toMatch(/^\/ordine_product_ui_[a-z0-9_]+$/u);
    const sql = postgres(databaseUrl!, { max: 1 });
    onTestFinished(() => sql.end());
    const db = drizzle(sql, { schema });
    const thread = await createAgentThreadsService(db).create({
      title: "Prepared submission verification",
    });
    expect(thread.isOk()).toBe(true);
    if (thread.isErr()) throw thread.error;
    onTestFinished(async () => {
      await sql`DELETE FROM pipeline_agent_sessions WHERE id = ${thread.value.id}`;
    });
    const submissions: string[] = [];
    const service = createAgentControlService(db, {
      execution: {
        submissionMode: "prepared-run",
        runPipeline: async ({ requestId }) => {
          submissions.push(requestId!);

          return ok({
            apiVersion: 2,
            requestId,
            state: "awaiting_approval",
            preparedRunId: randomUUID(),
            approvalId: randomUUID(),
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
          });
        },
        runOperation: async () => {
          throw new Error("Unexpected operation execution");
        },
        runRoutine: async () => {
          throw new Error("Unexpected routine execution");
        },
        controlJob: async () => {
          throw new Error("Unexpected Job control");
        },
      },
    });
    const input = { pipelineId: randomUUID(), callId: randomUUID() };
    const context = {
      actor: "local-owner" as const,
      audience: "internal-run" as const,
      scopes: new Set(AgentControlScopeSchema.options),
      threadId: thread.value.id,
      runId: null,
      readonly: false,
    };
    const result = await service.invoke("ordine.prepare_pipeline_run", input, context);
    expect(result.status, JSON.stringify(result)).toBe("succeeded");
    expect(submissions).toEqual([result.actionId]);
    expect(result.resources).toEqual([{ type: "pipeline", id: input.pipelineId }]);
    expect(result.summary).toContain("review and approve");
    expect(result.data).toMatchObject({
      executionReceipt: { requestId: result.actionId, state: "awaiting_approval" },
    });
    const rows = await sql`SELECT forward_action FROM agent_actions WHERE id = ${result.actionId}`;
    expect(rows[0]!.forward_action).toBeNull();
    const approvals =
      await sql`SELECT id FROM agent_approvals WHERE action_id = ${result.actionId}`;
    expect(approvals).toHaveLength(0);
    const replay = await service.invoke("ordine.prepare_pipeline_run", input, context);
    expect(replay.actionId).toBe(result.actionId);
    expect(submissions).toHaveLength(1);
  });
});
