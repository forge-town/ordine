import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/pglite";
import { agentRawExportsTable, pipelinesTable } from "@repo/db-schema";
import type { DbExecutor } from "../types";
import {
  createConnectorsDao,
  createConversationMessagesDao,
  createJobsDao,
  createPipelineAssetsDao,
  createProjectsDao,
  createRoutinesDao,
  createUsageDao,
} from "./index";

const rootDir = join(import.meta.dirname, "../../../..");
const migrationsDir = join(rootDir, "apps/create/migrations");

const applyMigrations = async (client: PGlite) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.exec(statement);
    }
  }
};

describe("COD-116 domain DAOs with PGlite", () => {
  const client = new PGlite();
  const executor = drizzle(client) as unknown as DbExecutor;

  beforeAll(async () => {
    await applyMigrations(client);
  });

  afterAll(async () => {
    await client.close();
  });

  it("persists CRUD, run statistics, and metered usage with real SQL", async () => {
    const projects = createProjectsDao(executor);
    const connectors = createConnectorsDao(executor);
    const messages = createConversationMessagesDao(executor);
    const routines = createRoutinesDao(executor);
    const assets = createPipelineAssetsDao(executor);
    const jobs = createJobsDao(executor);
    const usage = createUsageDao(executor);

    await projects.create({ id: "project-delete", name: "Disposable" });
    await projects.delete("project-delete");
    expect(await projects.findById("project-delete")).toBeUndefined();

    await projects.create({ id: "project-1", name: "Ordine" });
    await projects.update("project-1", { description: "Updated" });
    expect(await projects.findMany()).toEqual([
      expect.objectContaining({ id: "project-1", description: "Updated" }),
    ]);

    await executor
      .insert(pipelinesTable)
      .values({ id: "pipeline-1", name: "Pipeline", projectId: "project-1" });

    await connectors.create({ id: "connector-1", name: "MCP", method: "mcp" });
    await connectors.update("connector-1", { status: "connected" });
    expect(await connectors.findById("connector-1")).toEqual(
      expect.objectContaining({ status: "connected" }),
    );

    await messages.create({
      id: "message-1",
      pipelineId: "pipeline-1",
      role: "user",
      content: "Build",
    });
    await messages.update("message-1", { content: "Updated" });
    expect(await messages.findManyByPipelineId("pipeline-1")).toEqual([
      expect.objectContaining({ id: "message-1", content: "Updated" }),
    ]);

    await routines.create({
      id: "routine-1",
      pipelineId: "pipeline-1",
      name: "Nightly",
      description: "Runs the nightly pipeline",
      cronExpression: "0 0 * * *",
    });
    expect(await routines.findManyEnabled()).toEqual([
      expect.objectContaining({ id: "routine-1", description: "Runs the nightly pipeline" }),
    ]);
    await routines.update("routine-1", { enabled: false });
    expect(await routines.findManyEnabled()).toEqual([]);

    await assets.create({
      id: "asset-1",
      pipelineId: "pipeline-1",
      name: "Asset",
      snapshotNodes: [],
      snapshotEdges: [],
      tags: [],
    });
    await assets.update("asset-1", { name: "Updated Asset" });
    await assets.incrementRunStats("asset-1", { success: true, durationMs: 1200 });
    expect(await assets.findById("asset-1")).toEqual(
      expect.objectContaining({
        name: "Updated Asset",
        totalRuns: 1,
        successRate: "1.0000",
        avgDurationMs: 1200,
      }),
    );

    await jobs.create({
      id: "job-metered",
      title: "Metered",
      type: "pipeline_run",
      status: "done",
      pipelineId: "pipeline-1",
      totalTokens: 1200,
    });
    await jobs.create({
      id: "job-unmetered",
      title: "Queued",
      type: "pipeline_run",
    });
    await jobs.create({
      id: "job-unassigned",
      title: "Unassigned",
      type: "operation_run",
      status: "done",
      totalTokens: 100,
    });
    await jobs.setNodeStatuses("job-metered", { "node-1": "done" });
    expect(await jobs.findById("job-metered")).toEqual(
      expect.objectContaining({ nodeStatuses: { "node-1": "done" } }),
    );

    await executor.insert(agentRawExportsTable).values({
      jobId: "job-metered",
      agentRuntime: "codex",
      agentId: "agent-1",
      rawPayload: {},
      tokenInput: 400,
      tokenOutput: 800,
    });

    const range = { from: new Date("2020-01-01"), to: new Date("2030-01-01") };
    expect(await usage.getSummary(range)).toEqual({ totalTokens: 1300, runCount: 2 });
    expect(await usage.getDailyTokenSeries(range)).toEqual([
      expect.objectContaining({ tokens: 1300 }),
    ]);
    expect(await usage.getByPipeline(range)).toEqual([
      expect.objectContaining({ pipelineId: "pipeline-1", totalTokens: 1200, runCount: 1 }),
      expect.objectContaining({ pipelineId: null, totalTokens: 100, runCount: 1 }),
    ]);
    expect(await usage.getByAgent(range)).toEqual([
      expect.objectContaining({ agentId: "agent-1", tokens: 1200, runCount: 1 }),
    ]);

    await messages.create({
      id: "message-2",
      pipelineId: "pipeline-1",
      role: "agent",
      content: "Done",
    });
    await messages.deleteAll();
    expect(await messages.findMany()).toEqual([]);

    await messages.delete("message-1");
    await routines.delete("routine-1");
    await assets.delete("asset-1");
    await connectors.delete("connector-1");
    expect(await messages.findById("message-1")).toBeUndefined();
    expect(await routines.findById("routine-1")).toBeUndefined();
    expect(await assets.findById("asset-1")).toBeUndefined();
    expect(await connectors.findById("connector-1")).toBeUndefined();
  });
});
