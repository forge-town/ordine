import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { existsSync, unlinkSync, mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { event } from "./fixtures/execution";
import { envSchema } from "../src/integrations/env/envSchema";

const requests: Array<{ method: string; url: string; desktopToken?: string; version?: string }> =
  [];

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const handleRequest = (request: IncomingMessage, response: ServerResponse): void => {
  requests.push({
    method: request.method ?? "GET",
    url: request.url ?? "/",
    desktopToken: request.headers["x-desktop-token"] as string | undefined,
    version: request.headers["x-ordine-api-version"] as string | undefined,
  });

  if (request.method === "GET" && request.url === "/api/v2/jobs") {
    sendJson(response, 200, []);
    return;
  }
  if (request.method === "GET" && request.url === "/api/v2/pipelines") {
    sendJson(response, 200, []);
    return;
  }
  if (request.method === "POST" && request.url === "/api/v2/run-requests") {
    let body = "";
    request.on("data", (chunk) => {
      body += String(chunk);
    });
    request.on("end", () => {
      const input = JSON.parse(body);
      sendJson(response, 202, {
        apiVersion: 2,
        requestId: input.requestId,
        state: "awaiting_approval",
        preparedRunId: "prepared-1",
        approvalId: "approval-1",
        expiresAt: "2026-09-08T12:00:00Z",
      });
    });
    return;
  }
  if (request.method === "GET" && request.url?.startsWith("/api/v2/run-requests/")) {
    sendJson(response, 200, {
      apiVersion: 2,
      requestId: request.url.split("/").at(-1),
      state: "accepted",
      preparedRunId: "prepared-1",
      jobId: "job-1",
      acceptedAt: "2026-09-08T12:00:00Z",
    });
    return;
  }
  if (
    request.method === "GET" &&
    request.url === "/api/v2/jobs/job-1/events?afterSequence=7&limit=25"
  ) {
    sendJson(response, 200, [event]);
    return;
  }
  if (request.method === "GET" && request.url === "/api/v2/jobs/job-1/result") {
    sendJson(response, 503, {
      error: {
        code: "RESULT_UNAVAILABLE",
        message: "Result backend unavailable",
        retryable: true,
        stage: "execution",
        jobId: "job-1",
      },
    });
    return;
  }
  if (
    request.method === "GET" &&
    request.url === "/api/v2/artifacts/artifact-1/content?offset=0&length=3"
  ) {
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(Buffer.from([0, 255, 128]));
    return;
  }
  if (request.method === "GET" && request.url === "/api/best-practices/export") {
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end("exported-data");

    return;
  }

  sendJson(response, 404, { error: "Not found" });
};

const server = createServer(handleRequest);
let apiUrl = "";
const tempDirectory = mkdtempSync(join(tmpdir(), "ordine-cli-v2-"));
const exportOutPath = join(tempDirectory, "export.bestpractice");

const runCli = (
  args: string[],
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    const child = spawn("bun", ["src/index.ts", ...args], {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        ORDINE_API_URL: apiUrl,
        ORDINE_AUTH_MODE: "desktop",
        ORDINE_DESKTOP_AUTH_TOKEN_FILE: undefined,
        ORDINE_DESKTOP_AUTH_TOKEN: "test-desktop-token-that-is-long-enough",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind a port");
  apiUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (existsSync(exportOutPath)) unlinkSync(exportOutPath);
  rmSync(tempDirectory, { recursive: true, force: true });
});

describe("Codex-facing CLI", () => {
  it("defaults to the standalone REST API port", () => {
    expect(envSchema.parse({}).ORDINE_API_URL).toBe("http://localhost:19433");
  });

  it("executes the real stdio MCP to HTTP v2 path with immediate approval receipts", async () => {
    const transport = new StdioClientTransport({
      command: "bun",
      args: ["src/index.ts", "mcp", "serve", "--allow-write"],
      cwd: fileURLToPath(new URL("../", import.meta.url)),
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] =>
              typeof entry[1] === "string" && !entry[0].startsWith("ORDINE_"),
          ),
        ),
        ORDINE_API_URL: apiUrl,
        ORDINE_AUTH_MODE: "desktop",
        ORDINE_DESKTOP_AUTH_TOKEN: "test-desktop-token-that-is-long-enough",
      },
      stderr: "pipe",
    });
    const client = new Client({ name: "v2-integration", version: "1" });
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.every((tool) => tool.name.startsWith("ordine.v2."))).toBe(true);
    const before = requests.length;
    const requestId = "11111111-1111-4111-8111-111111111111";
    const submitted = await client.callTool({
      name: "ordine.v2.run_requests.submit",
      arguments: { apiVersion: 2, requestId, pipelineId: "pipe-1", expectedRevision: 1 },
    });
    expect(submitted).toMatchObject({
      structuredContent: {
        requestId,
        state: "awaiting_approval",
        nextStep: expect.stringContaining("ORDINE App"),
      },
    });
    expect(requests.slice(before)).toHaveLength(1);
    expect(
      await client.callTool({ name: "ordine.v2.run_requests.get", arguments: { requestId } }),
    ).toMatchObject({ structuredContent: { state: "accepted", jobId: "job-1" } });
    expect(
      await client.callTool({ name: "ordine.v2.jobs.list", arguments: {} }),
    ).not.toHaveProperty("isError", true);
    await client.close();
  });

  it("lists v2 pipelines through real HTTP with auth and protocol header", async () => {
    const result = await runCli(["execution", "pipelines", "list"]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([]);
    expect(requests.at(-1)).toEqual({
      method: "GET",
      url: "/api/v2/pipelines",
      desktopToken: "test-desktop-token-that-is-long-enough",
      version: "2",
    });
  });
  it("submits an explicit requestId once, returns immediately for App approval, and recovers", async () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    const file = join(tempDirectory, "request.json");
    writeFileSync(
      file,
      JSON.stringify({ apiVersion: 2, requestId, pipelineId: "pipe-1", expectedRevision: 1 }),
      "utf8",
    );
    const before = requests.length;
    const result = await runCli(["execution", "run-requests", "submit", file]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      requestId,
      state: "awaiting_approval",
      nextStep: expect.stringContaining("ORDINE App"),
    });
    expect(requests.slice(before)).toHaveLength(1);
    const recovered = await runCli(["execution", "run-requests", "get", requestId]);
    expect(recovered.exitCode).toBe(0);
    expect(JSON.parse(recovered.stdout)).toMatchObject({
      requestId,
      state: "accepted",
      jobId: "job-1",
    });
  });
  it("reads persisted events by sequence cursor", async () => {
    const result = await runCli([
      "execution",
      "jobs",
      "events",
      "job-1",
      "--after-sequence",
      "7",
      "--limit",
      "25",
    ]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([event]);
  });
  it("reports structured v2 errors with nonzero exit and no success output", async () => {
    const result = await runCli(["execution", "jobs", "result", "job-1"]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("RESULT_UNAVAILABLE");
  });
  it("writes exact artifact bytes to the explicit output path", async () => {
    const file = join(tempDirectory, "artifact.bin");
    const result = await runCli([
      "execution",
      "artifacts",
      "content",
      "artifact-1",
      file,
      "--length",
      "3",
    ]);
    expect(result.exitCode).toBe(0);
    expect(readFileSync(file)).toEqual(Buffer.from([0, 255, 128]));
  });
  it("rejects old execution commands before making requests", async () => {
    for (const args of [
      ["run", "pipe-1"],
      ["pipelines", "list"],
      ["operations", "list"],
      ["jobs", "traces", "job-1"],
    ]) {
      const before = requests.length;
      expect((await runCli(args)).exitCode).toBe(1);
      expect(requests.length).toBe(before);
    }
  });

  it("sends Desktop authentication when exporting best practices", async () => {
    const result = await runCli(["best-practices", "export", exportOutPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(requests.at(-1)).toEqual({
      method: "GET",
      url: "/api/best-practices/export",
      version: undefined,
      desktopToken: "test-desktop-token-that-is-long-enough",
    });
  });

  it("prints absolute runtime and CLI paths instead of a bare ordine PATH command", async () => {
    const result = await runCli(["--json", "mcp", "print-config", "claude-code"]);
    const planned = JSON.parse(result.stdout) as { command: string };

    expect(result.exitCode).toBe(0);
    expect(planned.command).toContain("claude mcp add");
    expect(planned.command).toMatch(/src[\\/]index\.ts/);
    expect(planned.command).not.toMatch(/-- ordine mcp serve/);
    expect(planned.command).toContain("ORDINE_AUTH_MODE=bearer");
    expect(planned.command).not.toContain("ORDINE_DESKTOP_AUTH_TOKEN_FILE=");
    expect(planned.command).not.toContain("test-desktop-token");
  });

  it("refuses to print raw authentication supplied through installer --env", async () => {
    const secret = "s".repeat(32);
    const result = await runCli([
      "--json",
      "mcp",
      "print-config",
      "codex",
      "--env",
      `ORDINE_AGENT_API_TOKEN=${secret}`,
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stdout + result.stderr).not.toContain(secret);
    expect(result.stderr).toMatch(/token file/i);
  });
});
