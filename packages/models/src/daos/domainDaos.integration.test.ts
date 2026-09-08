import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  agentChangeSetsTable,
  agentRawExportsTable,
  pipelineAgentSessionsTable,
  pipelinesTable,
} from "@repo/db-schema";
import type { DbConnection, DbExecutor } from "../types";
import { createAgentControlRepository } from "../repositories/agentControlRepository";
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
const testDatabaseUrl = new URL(
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/ordine",
);
testDatabaseUrl.pathname = "/ordine_models_test";
const databaseUrl = process.env.ORDINE_MODELS_TEST_DATABASE_URL ?? testDatabaseUrl.toString();

const applyMigrations = async (client: ReturnType<typeof postgres>) => {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const statements = readFileSync(join(migrationsDir, file), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.unsafe(statement);
    }
  }
};

describe("COD-116 domain DAOs with PostgreSQL", () => {
  const client = postgres(databaseUrl, { onnotice: () => {} });
  const executor = drizzle(client) as unknown as DbExecutor;

  beforeAll(async () => {
    await client.unsafe("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    await applyMigrations(client);
  });

  afterAll(async () => {
    await client.end();
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

  it.each(["UTC", "Asia/Shanghai", "America/New_York"])(
    "expires only stale Job leases with the database session in %s",
    async (timeZone) => {
      const zoneClient = postgres(databaseUrl, {
        connection: { TimeZone: timeZone },
        max: 1,
        onnotice: () => {},
      });
      const zoneExecutor = drizzle(zoneClient) as unknown as DbExecutor;
      const jobs = createJobsDao(zoneExecutor);
      const observedAt = new Date("2026-06-01T12:00:00.000Z");
      const minute = 60_000;
      const prefix = `expiry-${timeZone.replaceAll("/", "-").toLowerCase()}`;
      const ids = {
        queuedStale: `${prefix}-queued-stale`,
        queuedFresh: `${prefix}-queued-fresh`,
        runningWithLease: `${prefix}-running-with-lease`,
        pausedWithLease: `${prefix}-paused-with-lease`,
        leaseExpired: `${prefix}-lease-expired`,
        legacyStale: `${prefix}-legacy-stale`,
        legacyFresh: `${prefix}-legacy-fresh`,
        providerFailed: `${prefix}-provider-failed`,
      };

      const seedJob = async ({
        id,
        status,
        createdAt,
        lastProgressAt,
        leaseExpiresAt = null,
        leaseOwnerId = null,
        error = null,
      }: {
        id: string;
        status: "queued" | "running" | "paused" | "failed";
        createdAt: Date;
        lastProgressAt: Date;
        leaseExpiresAt?: Date | null;
        leaseOwnerId?: string | null;
        error?: string | null;
      }) => {
        await jobs.create({ id, title: id, type: "pipeline_run", status });
        await zoneClient.unsafe(
          `UPDATE jobs
             SET status = $2,
                 created_at = $3,
                 updated_at = $4,
                 started_at = $5,
                 last_progress_at = $6,
                 heartbeat_at = $7,
                 lease_owner_id = $8,
                 lease_expires_at = $9,
                 error = $10
           WHERE id = $1`,
          [
            id,
            status,
            createdAt.toISOString(),
            lastProgressAt.toISOString(),
            status === "queued" ? null : createdAt.toISOString(),
            lastProgressAt.toISOString(),
            leaseOwnerId ? lastProgressAt.toISOString() : null,
            leaseOwnerId,
            leaseExpiresAt?.toISOString() ?? null,
            error,
          ],
        );
      };

      await seedJob({
        id: ids.queuedStale,
        status: "queued",
        createdAt: new Date(observedAt.getTime() - 2 * minute),
        lastProgressAt: new Date(observedAt.getTime() - 2 * minute),
      });
      await seedJob({
        id: ids.queuedFresh,
        status: "queued",
        createdAt: new Date(observedAt.getTime() - minute / 2),
        lastProgressAt: new Date(observedAt.getTime() - minute / 2),
      });
      await seedJob({
        id: ids.runningWithLease,
        status: "running",
        createdAt: new Date(observedAt.getTime() - 24 * 60 * minute),
        lastProgressAt: new Date(observedAt.getTime() - 24 * 60 * minute),
        leaseOwnerId: "worker-live",
        leaseExpiresAt: new Date(observedAt.getTime() + minute),
      });
      await seedJob({
        id: ids.pausedWithLease,
        status: "paused",
        createdAt: new Date(observedAt.getTime() - 24 * 60 * minute),
        lastProgressAt: new Date(observedAt.getTime() - 24 * 60 * minute),
        leaseOwnerId: "worker-paused",
        leaseExpiresAt: new Date(observedAt.getTime() + minute),
      });
      await seedJob({
        id: ids.leaseExpired,
        status: "running",
        createdAt: new Date(observedAt.getTime() - 2 * minute),
        lastProgressAt: new Date(observedAt.getTime() - minute / 2),
        leaseOwnerId: "worker-stale",
        leaseExpiresAt: new Date(observedAt.getTime() - 1),
      });
      await seedJob({
        id: ids.legacyStale,
        status: "running",
        createdAt: new Date(observedAt.getTime() - 2 * minute),
        lastProgressAt: new Date(observedAt.getTime() - 2 * minute),
      });
      await seedJob({
        id: ids.legacyFresh,
        status: "paused",
        createdAt: new Date(observedAt.getTime() - 2 * minute),
        lastProgressAt: new Date(observedAt.getTime() - minute / 2),
      });
      await seedJob({
        id: ids.providerFailed,
        status: "failed",
        createdAt: new Date(observedAt.getTime() - 2 * minute),
        lastProgressAt: new Date(observedAt.getTime() - 2 * minute),
        error: "provider failed before timeout",
      });

      const expiryOptions = {
        observedAt,
        queuedTimeoutMs: minute,
        legacyNoLeaseTimeoutMs: minute,
        sweeperId: `sweeper-${timeZone}`,
      };
      const [firstSweep, concurrentSweep] = await Promise.all([
        jobs.expireStaleJobs(expiryOptions),
        jobs.expireStaleJobs(expiryOptions),
      ]);
      expect([...firstSweep, ...concurrentSweep].map(({ id }) => id).sort()).toEqual(
        [ids.leaseExpired, ids.legacyStale, ids.queuedStale].sort(),
      );

      await expect(jobs.findById(ids.queuedFresh)).resolves.toEqual(
        expect.objectContaining({ status: "queued", expiryContext: null }),
      );
      await expect(jobs.findById(ids.runningWithLease)).resolves.toEqual(
        expect.objectContaining({ status: "running", expiryContext: null }),
      );
      await expect(jobs.findById(ids.pausedWithLease)).resolves.toEqual(
        expect.objectContaining({ status: "paused", expiryContext: null }),
      );
      await expect(jobs.findById(ids.queuedStale)).resolves.toEqual(
        expect.objectContaining({
          status: "expired",
          expiryContext: expect.objectContaining({
            reason: "queue_timeout",
            previousStatus: "queued",
            observedAtMs: observedAt.getTime(),
            staleBeforeMs: observedAt.getTime() - minute,
            timeoutMs: minute,
          }),
        }),
      );
      await expect(jobs.findById(ids.leaseExpired)).resolves.toEqual(
        expect.objectContaining({
          status: "expired",
          expiryContext: expect.objectContaining({
            reason: "lease_expired",
            previousStatus: "running",
            observedAtMs: observedAt.getTime(),
            staleBeforeMs: observedAt.getTime(),
            timeoutMs: null,
          }),
        }),
      );
      await expect(jobs.findById(ids.legacyStale)).resolves.toEqual(
        expect.objectContaining({
          status: "expired",
          expiryContext: expect.objectContaining({
            reason: "legacy_no_lease_timeout",
            previousStatus: "running",
            observedAtMs: observedAt.getTime(),
            staleBeforeMs: observedAt.getTime() - minute,
            timeoutMs: minute,
          }),
        }),
      );
      await expect(jobs.findById(ids.providerFailed)).resolves.toEqual(
        expect.objectContaining({ status: "failed", error: "provider failed before timeout" }),
      );

      expect(
        await jobs.transitionStatus(ids.legacyStale, ["running", "paused"], "failed", {
          error: "provider failed after timeout",
          finishedAt: new Date(observedAt.getTime() + 1),
        }),
      ).toBeUndefined();
      await jobs.recordErrorIfExpired(ids.legacyStale, "provider failed after timeout");
      expect(
        await jobs.recordErrorIfExpired(ids.legacyStale, "must not overwrite original failure"),
      ).toBeUndefined();
      await expect(jobs.findById(ids.legacyStale)).resolves.toEqual(
        expect.objectContaining({
          status: "expired",
          error: "provider failed after timeout",
        }),
      );
      await expect(jobs.expireStaleJobs(expiryOptions)).resolves.toEqual([]);

      await zoneClient.end();
    },
  );

  it("keeps Agent Change Set undo and redo repeatable across multiple cycles", async () => {
    const pipelineId = "pipeline-agent-history";
    const threadId = "thread-agent-history";
    const changeSetId = "changeset-agent-history";
    const emptySnapshot = { nodes: [], edges: [] };
    await executor.insert(pipelinesTable).values({ id: pipelineId, name: "Agent history" });
    await executor.insert(pipelineAgentSessionsTable).values({
      id: threadId,
      title: "Agent history",
      entrypoint: "global-agent-bar",
      mode: "edit",
      status: "completed",
      pipelineId,
    });
    await executor.insert(agentChangeSetsTable).values({
      id: changeSetId,
      threadId,
      actor: "local-owner",
      kind: "agent-edit",
      targetType: "pipeline",
      targetId: pipelineId,
      baseVersion: 1,
      status: "ready",
      baseSnapshot: emptySnapshot,
      draftSnapshot: emptySnapshot,
    });
    const repository = createAgentControlRepository(executor as DbConnection);

    const applied = await repository.applyChangeSet(changeSetId, 1);
    expect(applied).toMatchObject({ type: "applied", newVersion: 2 });

    const firstRevert = await repository.compensateChangeSet({
      sourceChangeSetId: changeSetId,
      expectedVersion: 2,
      kind: "revert",
      id: "changeset-agent-history-revert-1",
    });
    expect(firstRevert).toMatchObject({ type: "applied", newVersion: 3 });

    const firstRedo = await repository.compensateChangeSet({
      sourceChangeSetId: changeSetId,
      expectedVersion: 3,
      kind: "redo",
      id: "changeset-agent-history-redo-1",
    });
    expect(firstRedo).toMatchObject({ type: "applied", newVersion: 4 });

    const secondRevert = await repository.compensateChangeSet({
      sourceChangeSetId: changeSetId,
      expectedVersion: 4,
      kind: "revert",
      id: "changeset-agent-history-revert-2",
    });
    expect(secondRevert).toMatchObject({ type: "applied", newVersion: 5 });
  });

  it("returns the latest N conversation messages in chronological order", async () => {
    const messages = createConversationMessagesDao(executor);

    await executor
      .insert(pipelinesTable)
      .values({ id: "pipeline-messages", name: "Messages", projectId: "project-1" });

    for (const i of [1, 2, 3, 4, 5]) {
      await messages.create({
        id: `msg-${i}`,
        pipelineId: "pipeline-messages",
        role: "user",
        content: `message-${i}`,
        createdAt: new Date(`2026-01-0${i}T00:00:00Z`),
      });
    }

    const latest = await messages.findManyByPipelineId("pipeline-messages", 3);
    expect(latest.map((m) => m.content)).toEqual(["message-3", "message-4", "message-5"]);

    const all = await messages.findManyByPipelineId("pipeline-messages");
    expect(all.map((m) => m.content)).toEqual([
      "message-1",
      "message-2",
      "message-3",
      "message-4",
      "message-5",
    ]);
  });

  it("returns the latest pipeline messages in a stable order when created_at ties", async () => {
    const projects = createProjectsDao(executor);
    const messages = createConversationMessagesDao(executor);

    await projects.create({ id: "project-order", name: "Ordered" });
    await executor.insert(pipelinesTable).values({
      id: "pipeline-order",
      name: "Ordering",
      projectId: "project-order",
    });

    const createdAt = new Date("2026-01-02T00:00:00.000Z");
    for (const i of [1, 2, 3, 4, 5]) {
      await messages.create({
        id: `message-${i}`,
        pipelineId: "pipeline-order",
        role: "user",
        content: `Message ${i}`,
        createdAt,
      });
    }

    await expect(messages.findManyByPipelineId("pipeline-order")).resolves.toEqual([
      expect.objectContaining({ id: "message-1" }),
      expect.objectContaining({ id: "message-2" }),
      expect.objectContaining({ id: "message-3" }),
      expect.objectContaining({ id: "message-4" }),
      expect.objectContaining({ id: "message-5" }),
    ]);
    await expect(messages.findManyByPipelineId("pipeline-order", 3)).resolves.toEqual([
      expect.objectContaining({ id: "message-3" }),
      expect.objectContaining({ id: "message-4" }),
      expect.objectContaining({ id: "message-5" }),
    ]);
  });
});
