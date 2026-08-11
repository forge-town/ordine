import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const requests: Array<{ method: string; url: string; desktopToken?: string }> = [];

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
};

const handleRequest = (request: IncomingMessage, response: ServerResponse): void => {
  requests.push({
    method: request.method ?? "GET",
    url: request.url ?? "/",
    desktopToken: request.headers["x-desktop-token"] as string | undefined,
  });

  if (request.method === "GET" && request.url === "/api/pipelines") {
    sendJson(response, 200, [{ id: "pipe-1", name: "Agent Pipeline", description: "", tags: [] }]);

    return;
  }
  if (request.method === "POST" && request.url === "/api/pipelines/pipe-1/run") {
    sendJson(response, 202, { jobId: "job-1" });

    return;
  }
  if (request.method === "GET" && request.url === "/api/jobs/job-1") {
    sendJson(response, 200, { id: "job-1", title: "Agent Pipeline", status: "done", error: null });

    return;
  }
  if (request.method === "GET" && request.url === "/api/jobs/job-1/traces") {
    sendJson(response, 200, [{ message: "completed" }]);

    return;
  }

  sendJson(response, 404, { error: "Not found" });
};

const server = createServer(handleRequest);
let apiUrl = "";

const runCli = (
  args: string[],
): Promise<{ exitCode: number | null; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    const child = spawn("bun", ["src/index.ts", ...args], {
      cwd: new URL("../", import.meta.url),
      env: {
        ...process.env,
        ORDINE_API_URL: apiUrl,
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
});

describe("Codex-facing CLI", () => {
  it("lists pipelines as machine-readable JSON over the real HTTP client", async () => {
    const result = await runCli(["--json", "pipelines", "list"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([
      { id: "pipe-1", name: "Agent Pipeline", description: "", tags: [] },
    ]);
    expect(requests.at(-1)).toEqual({
      method: "GET",
      url: "/api/pipelines",
      desktopToken: "test-desktop-token-that-is-long-enough",
    });
  });

  it("runs a pipeline and returns the final job with traces as JSON", async () => {
    const result = await runCli(["--json", "run", "pipe-1"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual({
      job: { id: "job-1", title: "Agent Pipeline", status: "done", error: null },
      traces: [{ message: "completed" }],
    });
  });

  it("reads job traces directly as JSON", async () => {
    const result = await runCli(["--json", "jobs", "traces", "job-1"]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([{ message: "completed" }]);
  });
});
