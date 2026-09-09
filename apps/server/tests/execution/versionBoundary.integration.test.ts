import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { expect, it, vi, onTestFinished } from "vitest";
import { createExecutionApplication } from "../../src/executionComposition";
import * as f from "./fixtures";

const oldRoot = process.env.ORDINE_LEGACY_TEST_ROOT;
it.runIf(oldRoot)(
  "rejects the actual old CLI and App health probe at the outer application without DB access",
  async () => {
    const query = vi.fn(() => {
      throw new Error("Legacy requests must not access the database");
    });
    const connection = new Proxy({}, { get: () => query });
    const application = (
      await createExecutionApplication({
        database: { connection } as never,
        artifactDirectory: await mkdtemp(join(tmpdir(), "ordine-version-boundary-")),
        workspaceId: "workspace-1",
        subjectId: "owner",
        instanceId: "version-boundary",
        buildRevision: "test",
        auth: f.auth,
        scriptExecutables: {},
      })
    )._unsafeUnwrap();
    const server = serve({ fetch: application.app.fetch, port: 0, hostname: "127.0.0.1" });
    onTestFinished(async () => {
      if ("closeAllConnections" in server) server.closeAllConnections();
      await new Promise<void>((done) => server.close(() => done()));
    });
    await new Promise<void>((done) => (server.listening ? done() : server.once("listening", done)));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected local TCP port");
    const url = `http://127.0.0.1:${address.port}`;
    const health = await fetch(`${url}/health`);
    expect(health.status).toBe(426);
    expect(await health.json()).toMatchObject({
      error: { code: "EXECUTION_API_VERSION_UNSUPPORTED" },
    });
    const outcome = await new Promise<{ code: unknown; stdout: string; stderr: string }>((done) => {
      execFile(
        "bun",
        [join(oldRoot!, "apps/cli/src/index.ts"), "pipelines", "list", "--json"],
        {
          cwd: oldRoot,
          windowsHide: true,
          timeout: 15_000,
          env: {
            ...Object.fromEntries(
              Object.entries(process.env).filter(
                ([key]) => key !== "ORDINE_DESKTOP_AUTH_TOKEN_FILE",
              ),
            ),
            ORDINE_API_URL: url,
            ORDINE_DESKTOP_AUTH_TOKEN: f.agentToken,
          },
        },
        (error, stdout, stderr) => done({ code: error?.code ?? 0, stdout, stderr }),
      );
    });
    expect(outcome.code).toBe(1);
    expect(outcome.stderr + outcome.stdout).toContain("EXECUTION_API_VERSION_UNSUPPORTED");
    expect(query).not.toHaveBeenCalled();
  },
  25_000,
);
