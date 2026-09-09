import { describe, expect, it, vi } from "vitest";
import { errAsync, okAsync } from "neverthrow";
import { ExecutionErrorSchema, ExecutionReadinessSchema } from "@repo/schemas";
import { createExecutionApi } from "../../src/execution/createExecutionApi";
import * as f from "./fixtures";

const setup = () => {
  const service = f.mockService();

  return { service, app: createExecutionApi({ service, auth: f.auth, readiness: f.readiness }) };
};
const headers = {
  "X-Ordine-Api-Version": "2",
  "X-Desktop-Token": f.agentToken,
  "Content-Type": "application/json",
};
it.each([
  ["GET", "/health"],
  ["GET", "/api/jobs"],
  ["GET", "/api/pipelines"],
  ["POST", "/api/pipelines/old-pipeline/run"],
])(
  "rejects legacy %s %s with an explicit version error without invoking services",
  async (method, path) => {
    const { app, service } = setup();
    const response = await app.request(path, { method });
    expect(response.status).toBe(426);
    expect(await response.json()).toMatchObject({
      error: { code: "EXECUTION_API_VERSION_UNSUPPORTED" },
    });
    for (const handler of Object.values(service)) expect(handler).not.toHaveBeenCalled();
  },
);
const routes = [
  ["GET", "/operations", "listOperations", [f.operation], undefined, []],
  [
    "GET",
    "/operations/op-1/revisions/1",
    "getOperationRevision",
    f.operation,
    undefined,
    ["op-1", 1],
  ],
  [
    "PUT",
    "/operations/op-1",
    "saveOperation",
    f.operation,
    { apiVersion: 2, expectedRevision: 0, operation: f.operation },
    [{ apiVersion: 2, expectedRevision: 0, operation: f.operation }],
  ],
  ["GET", "/pipelines", "listPipelines", [f.pipeline], undefined, []],
  ["GET", "/pipelines/pipeline-1", "getPipeline", f.pipeline, undefined, ["pipeline-1"]],
  ["PUT", "/pipelines/pipeline-1", "savePipeline", f.pipeline, f.savePipeline, [f.savePipeline]],
  ["POST", "/run-requests", "submit", f.pending, f.submission, [f.submission]],
  ["GET", `/run-requests/${f.requestId}`, "getRequest", f.accepted, undefined, [f.requestId]],
  ["GET", "/jobs", "listJobs", [f.job], undefined, []],
  ["GET", "/job-summaries", "listJobSummaries", [f.jobSummary], undefined, []],
  ["GET", "/job-summaries/job-1", "getJobSummary", f.jobSummary, undefined, ["job-1"]],
  ["GET", "/jobs/job-1", "getJob", f.job, undefined, ["job-1"]],
  [
    "GET",
    "/jobs/job-1/events?afterSequence=7&limit=25",
    "getEvents",
    [f.event],
    undefined,
    ["job-1", 7, 25],
  ],
  ["GET", "/jobs/job-1/result", "getResult", f.result, undefined, ["job-1"]],
  ["GET", "/jobs/job-1/artifacts", "listArtifacts", [f.artifact], undefined, ["job-1"]],
  [
    "POST",
    "/jobs/job-1/control",
    "controlJob",
    f.job,
    { action: "pause" },
    ["job-1", { action: "pause" }],
  ],
  ["POST", "/jobs/job-1/checkpoints/node-1/ack", "ackCheckpoint", f.job, {}, ["job-1", "node-1"]],
  ["GET", "/artifacts/artifact-1", "getArtifact", f.artifact, undefined, ["artifact-1"]],
  [
    "POST",
    "/input-assets",
    "importInput",
    f.asset,
    {
      importRequestId: f.requestId,
      name: "input.bin",
      mimeType: "application/octet-stream",
      contentBase64: "AP+A",
    },
    [
      {
        importRequestId: f.requestId,
        name: "input.bin",
        mimeType: "application/octet-stream",
        contentBase64: "AP+A",
      },
    ],
  ],
  ["GET", "/approvals/approval-1", "getApproval", f.approval, undefined, ["approval-1"]],
  ["GET", "/runtime-configs", "listRuntimeConfigs", [f.runtime], undefined, []],
  [
    "PUT",
    "/runtime-configs/local-codex",
    "saveRuntimeConfig",
    f.runtime,
    { apiVersion: 2, expectedRevision: 0, config: f.runtime.config },
    [{ apiVersion: 2, expectedRevision: 0, config: f.runtime.config }],
  ],
  ["GET", "/workspace-settings", "getWorkspaceSettings", f.settings, undefined, []],
  [
    "PUT",
    "/workspace-settings",
    "saveWorkspaceSettings",
    f.settings,
    { apiVersion: 2, expectedRevision: 0, executionDefaults: {} },
    [{ apiVersion: 2, expectedRevision: 0, executionDefaults: {} }],
  ],
] as const;

describe("execution v2 HTTP contracts", () => {
  it.each(routes)(
    "routes %s %s directly to the scoped service and shared DTO",
    async (method, path, action, expected, body, args) => {
      const { app, service } = setup();
      const response = await app.request(`/api/v2${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      expect(response.status).toBe(
        path === "/run-requests" ? 202 : path === "/input-assets" ? 201 : 200,
      );
      expect(await response.json()).toEqual(expected);
      expect(service[action]).toHaveBeenCalledWith(f.principal, ...args);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    },
  );
  it("serves versioned authenticated readiness and checks read scope", async () => {
    const { app } = setup();
    const response = await app.request("/api/v2/readiness", { headers });
    expect(response.status).toBe(200);
    expect(ExecutionReadinessSchema.parse(await response.json()).status).toBe("ready");
    const noRead = createExecutionApi({
      service: f.mockService(),
      readiness: f.readiness,
      auth: {
        ...f.auth,
        credentials: [{ ...f.auth.credentials[0]!, scopes: ["execution:submit"] }],
      },
    });
    expect((await noRead.request("/api/v2/readiness", { headers })).status).toBe(403);
  });
  it("returns byte-for-byte artifact ranges with provenance headers", async () => {
    const { app, service } = setup();
    const response = await app.request("/api/v2/artifacts/artifact-1/content?offset=0&length=3", {
      headers,
    });
    expect(response.status).toBe(206);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(Uint8Array.of(0, 255, 128));
    expect(response.headers.get("Content-Range")).toBe("bytes 0-2/3");
    expect(response.headers.get("X-Ordine-Artifact-Sha256")).toBe(f.artifact.sha256);
    expect(response.headers.get("Content-Disposition")).toContain("output.bin");
    expect(service.readArtifact).toHaveBeenCalledWith(f.principal, "artifact-1", {
      offset: 0,
      length: 3,
    });
  });
  it("accepts only the independent App credential for approve and reject", async () => {
    const { app, service } = setup();
    for (const action of ["approve", "reject"] as const) {
      for (const origin of [undefined, "https://app.example"]) {
        const denied = await app.request(`/api/v2/approvals/approval-1/${action}`, {
          method: "POST",
          headers: {
            ...headers,
            ...(origin ? { Origin: origin } : {}),
            "X-Scopes": "execution:approve",
            "X-Subject-Id": "owner",
          },
          body: JSON.stringify({ approved: true, scopes: ["execution:approve"] }),
        });
        expect(denied.status).toBe(403);
        expect(service[action]).not.toHaveBeenCalled();
      }
      const accepted = await app.request(`/api/v2/approvals/approval-1/${action}`, {
        method: "POST",
        headers: { ...headers, "X-Desktop-Token": f.appToken },
        body: "{}",
      });
      expect(accepted.status).toBe(200);
      expect(await accepted.json()).toEqual(action === "approve" ? f.accepted : f.rejected);
      expect(service[action]).toHaveBeenCalledWith(f.appPrincipal, "approval-1");
    }
  });
  it("handles valid CORS preflight before authentication or credential file reads", async () => {
    const reader = vi.fn(async () => f.agentToken);
    const app = createExecutionApi({
      service: f.mockService(),
      readiness: f.readiness,
      auth: {
        ...f.auth,
        credentials: [{ ...f.auth.credentials[0]!, token: undefined, readToken: reader }],
      },
    });
    const response = await app.request("/api/v2/run-requests", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, X-Desktop-Token, X-Ordine-Api-Version",
      },
    });
    expect(response.status).toBe(204);
    expect(reader).not.toHaveBeenCalled();
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("x-ordine-api-version");
    const denied = await app.request("/api/v2/jobs", {
      headers: { Origin: "https://app.example", "X-Ordine-Api-Version": "2" },
    });
    expect(denied.status).toBe(401);
  });
  it.each([
    { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
    { Origin: "null", "Access-Control-Request-Method": "GET" },
    { Origin: "https://app.example", "Access-Control-Request-Method": "DELETE" },
    {
      Origin: "https://app.example",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "X-Scopes",
    },
  ])("rejects untrusted or unsupported preflight %j", async (preflightHeaders) => {
    const { app } = setup();
    const response = await app.request("/api/v2/jobs", {
      method: "OPTIONS",
      headers: Object.fromEntries(
        Object.entries(preflightHeaders).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      ),
    });
    expect(response.status).toBe(403);
    expect(ExecutionErrorSchema.safeParse((await response.json()).error).success).toBe(true);
  });
  it.each([
    "/readiness",
    "/jobs",
    "/operations",
    "/approvals/approval-1",
    "/artifacts/artifact-1/content",
  ])("requires authentication and API version for %s", async (path) => {
    const { app, service } = setup();
    expect(
      (await app.request(`/api/v2${path}`, { headers: { "X-Ordine-Api-Version": "2" } })).status,
    ).toBe(401);
    expect(
      (await app.request(`/api/v2${path}`, { headers: { "X-Desktop-Token": f.agentToken } }))
        .status,
    ).toBe(426);
    for (const method of Object.values(service)) expect(method).not.toHaveBeenCalled();
  });
  it.each([
    ["GET", "/jobs/job-1/events?afterSequence=-1", undefined],
    ["GET", "/jobs/job-1/events?limit=1.5", undefined],
    ["GET", "/jobs/job-1/events?limit=5&limit=6", undefined],
    ["GET", "/jobs/job-1/events?afterSequence=9007199254740992", undefined],
    ["GET", "/jobs/job-1/events?afterSequence=0x10", undefined],
    ["GET", "/jobs?subjectId=other", undefined],
    ["GET", "/jobs/bad%20id", undefined],
    ["GET", "/run-requests/not-a-uuid", undefined],
    ["GET", "/artifacts/artifact-1/content?length=1048577", undefined],
    ["POST", "/run-requests", { ...f.submission, requestId: undefined }],
    ["POST", "/run-requests", { ...f.submission, inputPath: "C:/old.txt" }],
    ["POST", "/jobs/job-1/control", { action: "approve" }],
    ["POST", "/jobs/job-1/checkpoints/node-1/ack", { approved: true }],
    ["PUT", "/pipelines/wrong-id", f.savePipeline],
    ["PUT", "/operations/wrong-id", { apiVersion: 2, expectedRevision: 0, operation: f.operation }],
    [
      "PUT",
      "/runtime-configs/wrong-id",
      { apiVersion: 2, expectedRevision: 0, config: f.runtime.config },
    ],
  ])("rejects invalid %s %s before service invocation", async (method, path, body) => {
    const { app, service } = setup();
    const response = await app.request(`/api/v2${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    expect(response.status).toBe(400);
    expect(ExecutionErrorSchema.safeParse((await response.json()).error).success).toBe(true);
    for (const action of Object.values(service)) expect(action).not.toHaveBeenCalled();
  });
  it("rejects oversized streamed ordinary JSON and applies the separate input import limit", async () => {
    const { app, service } = setup();
    const normal = await app.request("/api/v2/run-requests", {
      method: "POST",
      headers,
      body: JSON.stringify({ content: "x".repeat(2 * 1024 * 1024) }),
    });
    expect(normal.status).toBe(413);
    expect(service.submit).not.toHaveBeenCalled();
    const body = {
      importRequestId: f.requestId,
      name: "input.bin",
      mimeType: "application/octet-stream",
      contentBase64: Buffer.alloc(3 * 1024 * 1024).toString("base64"),
    };
    expect(
      (
        await app.request("/api/v2/input-assets", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(201);
    expect(service.importInput).toHaveBeenCalledOnce();
    service.importInput.mockClear();
    expect(
      (
        await app.request("/api/v2/input-assets", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...body, contentBase64: "x".repeat(12 * 1024 * 1024) }),
        })
      ).status,
    ).toBe(413);
    expect(service.importInput).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON, bad encodings, content types, and fake large content lengths", async () => {
    const { app, service } = setup();
    for (const [body, extraHeaders, status] of [
      ["{invalid", {}, 400],
      ["{}", { "Content-Type": "text/plain" }, 400],
      ["{}", { "Content-Length": "999999999" }, 413],
      [Uint8Array.of(0xff, 0xfe), {}, 400],
    ] as const) {
      expect(
        (
          await app.request("/api/v2/run-requests", {
            method: "POST",
            headers: { ...headers, ...extraHeaders },
            body,
          })
        ).status,
      ).toBe(status);
    }
    expect(service.submit).not.toHaveBeenCalled();
  });
  it.each([
    ["NOT_FOUND", 404],
    ["REVISION_CONFLICT", 409],
    ["FORBIDDEN", 403],
    ["EXECUTION_SERVICE_FAILED", 503],
  ] as const)("maps %s into a standard error envelope", async (code, status) => {
    const { app, service } = setup();
    const error = ExecutionErrorSchema.parse({
      code,
      message: "Domain request failed",
      stage: "preparation",
      retryable: false,
    });
    service.getJob.mockReturnValue(errAsync(error));
    const response = await app.request("/api/v2/jobs/job-1", { headers });
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error });
  });
  it("contains unexpected exceptions and private error paths and rejects legacy DTO wrappers", async () => {
    const { app, service } = setup();
    service.getJob.mockImplementationOnce(() => {
      throw new Error("C:/private/database.key secret-token");
    });
    const unexpected = await app.request("/api/v2/jobs/job-1", { headers });
    expect(unexpected.status).toBe(500);
    expect(await unexpected.text()).not.toMatch(/private|database.key|secret-token/);
    service.getJob.mockReturnValueOnce(
      errAsync({
        code: "EXECUTION_SERVICE_FAILED",
        message: "Failed opening C:/private/database.key",
        stage: "execution",
        retryable: true,
      }),
    );
    const privateError = await app.request("/api/v2/jobs/job-1", { headers });
    expect(privateError.status).toBe(503);
    expect(await privateError.text()).not.toContain("C:/private");
    service.getJob.mockReturnValueOnce(okAsync({ data: f.job } as never));
    const legacy = await app.request("/api/v2/jobs/job-1", { headers });
    expect(legacy.status).toBe(500);
    expect((await legacy.json()).error.code).toBe("EXECUTION_RESPONSE_INVALID");
  });
  it("has no legacy execution fallback", async () => {
    const { app, service } = setup();
    expect(
      (await app.request("/api/pipelines/pipeline-1/run", { method: "POST", headers, body: "{}" }))
        .status,
    ).toBe(426);
    expect(service.submit).not.toHaveBeenCalled();
  });
  it("rejects service ranges that exceed the requested bytes or report inconsistent metadata", async () => {
    const { app, service } = setup();
    const tooLong = await app.request("/api/v2/artifacts/artifact-1/content?length=2", { headers });
    expect(tooLong.status).toBe(500);
    service.readArtifact.mockReturnValueOnce(
      okAsync({ metadata: f.artifact, bytes: Uint8Array.of(0), offset: 0, totalSizeBytes: 4 }),
    );
    expect((await app.request("/api/v2/artifacts/artifact-1/content", { headers })).status).toBe(
      500,
    );
  });
  it("retains the original requestId on an uncertain service outcome without retrying", async () => {
    const { app, service } = setup();
    service.submit.mockReturnValue(
      errAsync({
        code: "EXECUTION_SERVICE_FAILED",
        message: "Submission outcome unavailable",
        stage: "preparation",
        retryable: true,
        requestId: f.requestId,
      }),
    );
    const response = await app.request("/api/v2/run-requests", {
      method: "POST",
      headers,
      body: JSON.stringify(f.submission),
    });
    expect(response.status).toBe(503);
    expect((await response.json()).error.requestId).toBe(f.requestId);
    expect(service.submit).toHaveBeenCalledOnce();
    expect(service.approve).not.toHaveBeenCalled();
  });
});
