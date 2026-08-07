import { beforeEach, describe, expect, it, vi } from "vitest";

const { desktopRequest } = vi.hoisted(() => ({
  desktopRequest: vi.fn(),
}));

vi.mock("../platform", () => ({
  DESKTOP_API_BASE: "http://desktop.test/api",
  desktopRequest,
}));

const { dataProvider } = await import("./dataProvider");

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    status,
  });

beforeEach(() => {
  desktopRequest.mockReset();
  desktopRequest.mockImplementation(() => Promise.resolve(jsonResponse([])));
});

describe("desktop dataProvider", () => {
  it("uses registered resource paths and only forwards supported list filters", async () => {
    await dataProvider.getList!({
      resource: "conversationMessages",
      filters: [
        { field: "pipelineId", operator: "eq", value: "pipeline-1" },
        { field: "limit", operator: "eq", value: 20 },
        { field: "ignored", operator: "eq", value: "value" },
      ],
    });

    expect(desktopRequest).toHaveBeenCalledWith(
      "http://desktop.test/api/conversations?pipelineId=pipeline-1&limit=20",
    );

    await dataProvider.getList!({
      resource: "filesystem",
      filters: [{ field: "path", operator: "eq", value: "/workspace/project" }],
    });

    expect(desktopRequest).toHaveBeenLastCalledWith(
      "http://desktop.test/api/filesystem/browse?path=%2Fworkspace%2Fproject",
    );
  });

  it("rejects unknown resources and list failures explicitly", async () => {
    await expect(dataProvider.getList!({ resource: "unknown" })).rejects.toThrow(
      'Unknown resource "unknown"',
    );
    expect(desktopRequest).not.toHaveBeenCalled();

    desktopRequest.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(dataProvider.getList!({ resource: "projects" })).rejects.toThrow(
      "Failed to list projects: 503",
    );
  });

  it.each([
    {
      endpoint: "pipelines/run",
      payload: { id: "pipeline-1", inputPath: "/input" },
      request: [
        "http://desktop.test/api/pipelines/pipeline-1/run",
        "POST",
        { inputPath: "/input" },
      ],
    },
    {
      endpoint: "pipelines/analyzeIntent",
      payload: { name: "Pipeline", description: "Description" },
      request: [
        "http://desktop.test/api/pipelines/analyze-intent",
        "POST",
        { name: "Pipeline", description: "Description" },
      ],
    },
    {
      endpoint: "pipelines/generateStructure",
      payload: { name: "Pipeline", description: "Description" },
      request: [
        "http://desktop.test/api/pipelines/generate-structure",
        "POST",
        { name: "Pipeline", description: "Description" },
      ],
    },
    {
      endpoint: "pipelines/proposeActions",
      payload: { id: "pipeline-1", message: "Update", snapshot: { nodes: [], edges: [] } },
      request: [
        "http://desktop.test/api/pipelines/pipeline-1/propose-actions",
        "POST",
        { message: "Update", snapshot: { nodes: [], edges: [] } },
      ],
    },
    {
      endpoint: "connectors/connect",
      payload: { id: "connector-1" },
      request: ["http://desktop.test/api/connectors/connector-1/connect", "POST"],
    },
    {
      endpoint: "conversations/clearAll",
      request: ["http://desktop.test/api/conversations", "DELETE"],
    },
    {
      endpoint: "pipelineAssets/getUsageCount",
      payload: { id: "asset-1" },
      request: ["http://desktop.test/api/pipeline-assets/asset-1/usage-count", "GET"],
    },
    {
      endpoint: "pipelineAssets/incrementRunStats",
      payload: { id: "asset-1", stats: { success: true, durationMs: 12 } },
      request: [
        "http://desktop.test/api/pipeline-assets/asset-1/increment-run-stats",
        "POST",
        { success: true, durationMs: 12 },
      ],
    },
    {
      endpoint: "pipelineAssets/distillFromPipeline",
      payload: { pipelineId: "pipeline-1" },
      request: ["http://desktop.test/api/pipeline-assets/distill/pipeline-1", "POST"],
    },
    {
      endpoint: "routines/runNow",
      payload: { id: "routine-1" },
      request: ["http://desktop.test/api/routines/routine-1/run-now", "POST"],
    },
    {
      endpoint: "routines/occurrences",
      payload: {
        from: "2026-08-03T00:00:00.000Z",
        to: "2026-08-10T00:00:00.000Z",
      },
      request: [
        "http://desktop.test/api/routines/occurrences?from=2026-08-03T00%3A00%3A00.000Z&to=2026-08-10T00%3A00%3A00.000Z",
        "GET",
      ],
    },
    {
      endpoint: "usage/summary",
      payload: { from: "2026-08-01", to: "2026-08-04" },
      request: ["http://desktop.test/api/usage/summary?from=2026-08-01&to=2026-08-04", "GET"],
    },
    {
      endpoint: "usage/dailyTokenSeries",
      request: ["http://desktop.test/api/usage/daily-token-series", "GET"],
    },
    {
      endpoint: "usage/byPipeline",
      request: ["http://desktop.test/api/usage/by-pipeline", "GET"],
    },
    {
      endpoint: "usage/byAgent",
      request: ["http://desktop.test/api/usage/by-agent", "GET"],
    },
    {
      endpoint: "jobs/traces",
      payload: { jobId: "job-1" },
      request: ["http://desktop.test/api/jobs/job-1/traces", "GET"],
    },
    {
      endpoint: "jobs/agentRuns",
      payload: { jobId: "job-1" },
      request: ["http://desktop.test/api/jobs/job-1/agent-runs", "GET"],
    },
    {
      endpoint: "jobs/agentRunSpans",
      payload: { jobId: "job-1", rawExportId: 42 },
      request: ["http://desktop.test/api/jobs/job-1/agent-runs/42/spans", "GET"],
    },
    {
      endpoint: "jobs/pause",
      payload: { jobId: "job-1" },
      request: ["http://desktop.test/api/jobs/job-1/pause", "POST"],
    },
    {
      endpoint: "jobs/resume",
      payload: { jobId: "job-1" },
      request: ["http://desktop.test/api/jobs/job-1/resume", "POST"],
    },
    {
      endpoint: "jobs/cancel",
      payload: { jobId: "job-1" },
      request: ["http://desktop.test/api/jobs/job-1/cancel", "POST"],
    },
    {
      endpoint: "distillations/run",
      payload: { id: "distillation-1" },
      request: ["http://desktop.test/api/distillations/distillation-1/run", "POST"],
    },
    {
      endpoint: "operations/run",
      payload: { operationId: "operation-1", inputContent: "content" },
      request: [
        "http://desktop.test/api/operations/operation-1/run",
        "POST",
        { inputContent: "content" },
      ],
    },
  ])("maps the REST-backed $endpoint custom endpoint", async ({ endpoint, payload, request }) => {
    await dataProvider.custom!({ url: endpoint, method: "post", payload });

    const [url, method, body] = request;
    expect(desktopRequest).toHaveBeenCalledWith(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  });

  it("preserves the Web provider response shapes for job details", async () => {
    desktopRequest.mockResolvedValueOnce(jsonResponse([{ id: "trace-1" }]));
    await expect(
      dataProvider.custom!({
        url: "jobs/traces",
        method: "get",
        payload: { jobId: "job-1" },
      }),
    ).resolves.toEqual({ data: { traces: [{ id: "trace-1" }] } });

    desktopRequest
      .mockResolvedValueOnce(jsonResponse([{ id: "trace-1" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: 42, agentId: "agent-1" }]))
      .mockResolvedValueOnce(jsonResponse([{ id: "span-1" }]));
    await expect(
      dataProvider.custom!({
        url: "jobs/analysis",
        method: "get",
        payload: { jobId: "job-1" },
      }),
    ).resolves.toEqual({
      data: {
        traces: [{ id: "trace-1" }],
        agentRuns: [{ id: 42, agentId: "agent-1" }],
        spansByRun: { 42: [{ id: "span-1" }] },
      },
    });

    expect(desktopRequest).toHaveBeenNthCalledWith(2, "http://desktop.test/api/jobs/job-1/traces", {
      method: "GET",
      headers: undefined,
      body: undefined,
    });
    expect(desktopRequest).toHaveBeenNthCalledWith(
      4,
      "http://desktop.test/api/jobs/job-1/agent-runs/42/spans",
      { method: "GET", headers: undefined, body: undefined },
    );
  });

  it("rejects invalid and unsupported custom endpoint contracts before requesting", async () => {
    await expect(
      dataProvider.custom!({
        url: "pipelineAssets/getUsageCount",
        method: "get",
        payload: {},
      }),
    ).rejects.toThrow("Custom request requires payload.id");

    await expect(
      dataProvider.custom!({
        url: "jobs/agentRunSpans",
        method: "get",
        payload: { jobId: "job-1", rawExportId: "42" },
      }),
    ).rejects.toThrow("Custom request requires numeric payload.rawExportId");

    for (const endpoint of [
      "pipelines/optimizeFromDistillation",
      "refinements/start",
      "settings/scanRuntimes",
      "agentRuntimes/syncAll",
      "agentRuntimes/scanAndSync",
      "skills/previewImport",
      "skills/importCandidates",
    ]) {
      await expect(dataProvider.custom!({ url: endpoint, method: "post" })).rejects.toThrow(
        `Unsupported Desktop custom endpoint "${endpoint}"`,
      );
    }

    await expect(dataProvider.custom!({ url: "unknown/action", method: "post" })).rejects.toThrow(
      'Unknown Desktop custom endpoint "unknown/action"',
    );
    expect(desktopRequest).not.toHaveBeenCalled();
  });

  it("does not parse 204 responses as JSON", async () => {
    desktopRequest.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(
      dataProvider.deleteOne!({ resource: "projects", id: "project-1" }),
    ).resolves.toEqual({
      data: { id: "project-1" },
    });

    desktopRequest.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(
      dataProvider.custom!({ url: "conversations/clearAll", method: "delete" }),
    ).resolves.toEqual({ data: {} });
  });
});
