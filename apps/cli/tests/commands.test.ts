import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { listPipelines, runPipeline } from "../src/commands";
import { api } from "../src/api";

const mockApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("listPipelines", () => {
  it("prints pipelines when available", async () => {
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: [
        {
          id: "pipe-1",
          name: "Lint Check",
          description: "Runs linting",
          tags: ["lint"],
          createdAt: 0,
          updatedAt: 0,
        },
        {
          id: "pipe-2",
          name: "Security Scan",
          description: "",
          tags: [],
          createdAt: 0,
          updatedAt: 0,
        },
      ],
    } as never);

    await listPipelines();

    expect(mockApi.get).toHaveBeenCalledWith("/api/pipelines");
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Pipelines (2)"));
  });

  it("prints message when no pipelines", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: true, data: [] } as never);

    await listPipelines();

    expect(console.log).toHaveBeenCalledWith("No pipelines found.");
  });

  it("throws on API error", async () => {
    mockApi.get.mockResolvedValueOnce({ ok: false, status: 500, message: "Server error" } as never);

    await expect(listPipelines()).rejects.toThrow("Failed to list pipelines");
  });
});

describe("runPipeline", () => {
  it("triggers a pipeline run and prints job ID", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { jobId: "job-123" } } as never);
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: {
        id: "job-123",
        status: "done",
        logs: ["step 1"],
        result: { summary: "All good" },
        error: null,
      },
    } as never);

    await runPipeline("pipe-1", { inputPath: "/tmp/src" });

    expect(mockApi.post).toHaveBeenCalledWith("/api/pipelines/pipe-1/run", {
      inputPath: "/tmp/src",
    });
    expect(console.log).toHaveBeenCalledWith("Job created: job-123");
  });

  it("does not poll when follow is false", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { jobId: "job-456" } } as never);

    await runPipeline("pipe-1", { follow: false });

    expect(mockApi.post).toHaveBeenCalledOnce();
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("throws on API error during run", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: false, status: 404, message: "Not found" } as never);

    await expect(runPipeline("nonexistent", {})).rejects.toThrow("Failed to run pipeline");
  });

  it("throws when job fails", async () => {
    mockApi.post.mockResolvedValueOnce({ ok: true, data: { jobId: "job-fail" } } as never);
    mockApi.get.mockResolvedValueOnce({
      ok: true,
      data: { id: "job-fail", status: "failed", logs: [], result: null, error: "Syntax error" },
    } as never);

    await expect(runPipeline("pipe-1", {})).rejects.toThrow("Pipeline failed");
  });
});
