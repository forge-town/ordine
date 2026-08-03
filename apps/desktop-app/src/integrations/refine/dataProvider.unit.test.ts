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
  desktopRequest.mockResolvedValue(jsonResponse([]));
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

  it("maps custom resource actions and rejects payloads missing required identifiers", async () => {
    desktopRequest.mockResolvedValueOnce(jsonResponse({ jobId: "job-1" }));
    await dataProvider.custom!({
      url: "routines/runNow",
      method: "post",
      payload: { id: "routine-1" },
    });

    expect(desktopRequest).toHaveBeenCalledWith(
      "http://desktop.test/api/routines/routine-1/run-now",
      {
        method: "POST",
        headers: undefined,
        body: undefined,
      },
    );

    await expect(
      dataProvider.custom!({
        url: "pipelineAssets/getUsageCount",
        method: "get",
        payload: {},
      }),
    ).rejects.toThrow("Custom request requires payload.id");
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
