import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OperationRevisionSchema } from "@repo/schemas";
import { createExecutionDataProvider } from "./dataProvider";
const id = "11111111-1111-4111-8111-111111111111";
const receipt = {
  apiVersion: 2,
  requestId: id,
  preparedRunId: "prepared-1",
  state: "awaiting_approval",
  approvalId: "approval-1",
  expiresAt: "2026-09-08T13:00:00Z",
};
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());
describe("execution v2 Refine provider", () => {
  it("reads validated immutable Job summaries from their own v2 resource", async () => {
    const summary = {
      apiVersion: 2,
      id: "job",
      preparedRunId: "prepared",
      revision: 1,
      state: "succeeded",
      createdAt: "2026-09-08T00:00:00Z",
      startedAt: null,
      finishedAt: null,
      deadlineAt: null,
      waitingDeadlineAt: null,
      stopReason: null,
      error: null,
      warnings: [],
      pipelineId: "pipeline",
      pipelineName: "Approved snapshot",
      pipelineRevision: 3,
      requestId: id,
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json([summary]))
      .mockResolvedValueOnce(json(summary));
    const provider = createExecutionDataProvider({
      baseUrl: "http://127.0.0.1:19433",
      getHeaders: () => ({}),
      fetcher,
    });
    expect((await provider.getList({ resource: "job-summaries" })).data).toEqual([summary]);
    expect((await provider.getOne({ resource: "job-summaries", id: "job" })).data).toEqual(summary);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:19433/api/v2/job-summaries",
      "http://127.0.0.1:19433/api/v2/job-summaries/job",
    ]);
    fetcher.mockResolvedValueOnce(json([{ id: "legacy", title: "Old Job", status: "done" }]));
    await expect(provider.getList({ resource: "job-summaries" })).rejects.toThrow();
  });
  it("uses rotated App headers and v2 protocol without a legacy envelope", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    const identity = { token: "first" };
    const provider = createExecutionDataProvider({
      baseUrl: "http://127.0.0.1:9433",
      getHeaders: () => ({ "X-Desktop-Token": identity.token }),
      fetcher,
    });
    expect(await provider.getList({ resource: "pipelines" })).toEqual({ data: [], total: 0 });
    identity.token = "second";
    fetcher.mockResolvedValueOnce(json([]));
    await provider.getList({ resource: "pipelines" });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:9433/api/v2/pipelines",
      "http://127.0.0.1:9433/api/v2/pipelines",
    ]);
    expect(
      fetcher.mock.calls.map(([, init]) => new Headers(init?.headers).get("X-Desktop-Token")),
    ).toEqual(["first", "second"]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("X-Ordine-Api-Version")).toBe("2");
    fetcher.mockResolvedValueOnce(json({ data: [] }));
    await expect(provider.getList({ resource: "pipelines" })).rejects.toThrow();
  });
  it("submits once, returns pending approval, and never retries uncertain outcomes", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json(receipt, 202));
    const provider = createExecutionDataProvider({
      baseUrl: "http://localhost:9433",
      getHeaders: () => ({}),
      fetcher,
    });
    const variables = {
      apiVersion: 2,
      requestId: id,
      pipelineId: "pipeline-1",
      expectedRevision: 1,
    };
    expect(await provider.create({ resource: "run-requests", variables })).toEqual({
      data: receipt,
    });
    expect(fetcher).toHaveBeenCalledOnce();
    fetcher.mockRejectedValueOnce(new Error("timeout"));
    await expect(provider.create({ resource: "run-requests", variables })).rejects.toMatchObject({
      code: "NETWORK_UNCERTAIN",
      statusCode: 0,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body)).requestId).toBe(id);
  });
  it("preserves CAS conflict and permission errors for recoverable UI state", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json(
        {
          error: {
            code: "FORBIDDEN",
            message: "App approval required",
            retryable: false,
            stage: "authentication",
          },
        },
        403,
      ),
    );
    const provider = createExecutionDataProvider({
      baseUrl: "http://localhost:9433",
      getHeaders: () => ({}),
      fetcher,
    });
    await expect(
      provider.create({
        resource: "approval-actions",
        variables: { approvalId: "approval-1", action: "approve" },
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
    const operation = OperationRevisionSchema.parse({
      apiVersion: 2,
      id: "op-1",
      revision: 2,
      name: "Identity",
      inputPorts: [],
      outputPorts: [],
      executor: { kind: "builtin", name: "identity" },
    });
    fetcher.mockResolvedValueOnce(
      json(
        {
          error: {
            code: "REVISION_CONFLICT",
            message: "Revision changed",
            retryable: false,
            stage: "preparation",
          },
        },
        409,
      ),
    );
    await expect(
      provider.update({
        resource: "operations",
        id: "op-1",
        variables: { apiVersion: 2, expectedRevision: 1, operation },
      }),
    ).rejects.toMatchObject({ statusCode: 409, code: "REVISION_CONFLICT" });
  });
  it("reads an exact pinned operation revision and does not fall back to the head", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(
      json(
        {
          error: {
            code: "NOT_FOUND",
            message: "Pinned revision missing",
            retryable: false,
            stage: "preparation",
          },
        },
        404,
      ),
    );
    const provider = createExecutionDataProvider({
      baseUrl: "http://localhost:9433",
      getHeaders: () => ({}),
      fetcher,
    });
    await expect(
      provider.getList({
        resource: "operation-revisions",
        meta: { references: [{ operationId: "op-1", revision: 2 }] },
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "http://localhost:9433/api/v2/operations/op-1/revisions/2",
    );
  });
  it("downloads complete binary content in ranges and verifies SHA-256 before exposing a file", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const bytes = Uint8Array.from({ length: 1_048_580 }, (_, index) => index % 251);
    const digest = await webcrypto.subtle.digest("SHA-256", bytes);
    const sha256 = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("");
    const metadata = {
      artifactId: "asset-1",
      subjectId: "owner",
      workspaceId: "workspace-1",
      name: "report.bin",
      mimeType: "application/octet-stream",
      sizeBytes: bytes.length,
      sha256,
      createdAt: "2026-09-08T12:00:00Z",
    };
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json(metadata))
      .mockResolvedValueOnce(new Response(bytes.slice(0, 1_048_576)))
      .mockResolvedValueOnce(new Response(bytes.slice(1_048_576)));
    const provider = createExecutionDataProvider({
      baseUrl: "http://localhost:9433",
      getHeaders: () => ({}),
      fetcher,
    });
    const response = await provider.create({
      resource: "artifact-download",
      variables: { id: "asset-1" },
    });
    expect(response.data).toMatchObject({ name: "report.bin", sha256, sizeBytes: bytes.length });
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:9433/api/v2/artifacts/asset-1",
      "http://localhost:9433/api/v2/artifacts/asset-1/content?offset=0&length=1048576",
      "http://localhost:9433/api/v2/artifacts/asset-1/content?offset=1048576&length=4",
    ]);
    fetcher
      .mockResolvedValueOnce(json({ ...metadata, sizeBytes: 3, sha256: "0".repeat(64) }))
      .mockResolvedValueOnce(new Response(Uint8Array.of(1, 2, 3)));
    await expect(
      provider.create({ resource: "artifact-download", variables: { id: "asset-1" } }),
    ).rejects.toMatchObject({ code: "ARTIFACT_HASH_MISMATCH" });
  });
});
