import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { JobsPageStoreProvider } from "../_store";
import { JobsPageContent } from "./JobsPageContent";
import type { Job, PipelineData, Routine } from "@repo/schemas";

const mockNavigate = vi.fn();
const mockUpdate = vi.fn();
const mockData: {
  jobs: Job[];
  pipelines: PipelineData[];
  routines: Routine[];
} = {
  jobs: [],
  pipelines: [],
  routines: [],
};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", () => ({
  useCreate: () => ({ mutate: vi.fn() }),
  useDelete: () => ({ mutate: vi.fn() }),
  useList: ({ resource }: { resource: string }) => {
    if (resource === "jobs") {
      return { result: { data: mockData.jobs }, query: { isLoading: false, refetch: vi.fn() } };
    }
    if (resource === "routines") {
      return { result: { data: mockData.routines }, query: { isLoading: false, refetch: vi.fn() } };
    }
    if (resource === "pipelines") {
      return { result: { data: mockData.pipelines }, query: { isLoading: false } };
    }

    return { result: { data: [] }, query: { isLoading: false } };
  },
  useUpdate: () => ({ mutate: mockUpdate }),
}));

const today = new Date();

const renderContent = () =>
  render(
    <JobsPageStoreProvider>
      <JobsPageContent />
    </JobsPageStoreProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(dataProvider, "custom").mockResolvedValue({ data: {} });
  mockData.pipelines = [
    {
      id: "pipeline-1",
      projectId: null,
      version: 1,
      status: "ready",
      name: "Lead Research Brief",
      description: "",
      tags: [],
      nodes: [],
      edges: [],
      timeoutMs: null,
      createdAt: today,
      updatedAt: today,
    },
  ];
  mockData.jobs = [
    {
      id: "job-001",
      title: "Pipeline run",
      status: "running",
      type: "pipeline_run",
      parentJobId: null,
      pipelineId: "pipeline-1",
      projectId: null,
      error: null,
      startedAt: today,
      nodeStatuses: { input: "done", research: "running", output: "idle" },
      finishedAt: null,
      meta: { createdAt: today, updatedAt: today },
    },
    {
      id: "job-002",
      title: "Pipeline run",
      status: "running",
      type: "pipeline_run",
      parentJobId: null,
      pipelineId: "pipeline-1",
      projectId: null,
      error: null,
      startedAt: today,
      nodeStatuses: { checkpoint: "waitingForUser" },
      finishedAt: null,
      meta: { createdAt: today, updatedAt: today },
    },
  ];
  mockData.routines = [
    {
      id: "routine-1",
      pipelineId: "pipeline-1",
      name: "Daily intake",
      triggerType: "cron",
      cronExpression: "0 * * * *",
      eventType: null,
      eventConfig: null,
      inputConfig: null,
      enabled: true,
      lastRunAt: null,
      nextRunAt: today,
      createdAt: today,
      updatedAt: today,
    },
  ];
});

describe("JobsPageContent", () => {
  it("renders the fleet console with summary and table rows", () => {
    renderContent();

    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-summary")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-table")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-table-row-job-001")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-action-review-job-002")).toBeInTheDocument();
  });

  it("runs a row action through the jobs control endpoint", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByTestId("jobs-action-pause-job-001"));

    await waitFor(() => {
      expect(dataProvider.custom).toHaveBeenCalledWith(
        expect.objectContaining({ payload: { jobId: "job-001" }, url: "jobs/pause" }),
      );
    });
  });

  it("filters jobs by search", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.type(screen.getByPlaceholderText("Search jobs…"), "missing");

    expect(screen.getByText("No matching jobs")).toBeInTheDocument();
  });

  it("shows future routine occurrences on the calendar", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByTestId("jobs-view-calendar"));

    expect(screen.getByTestId("jobs-calendar")).toBeInTheDocument();
    expect(screen.getAllByText("Daily intake").length).toBeGreaterThan(0);
  });

  it("opens the pipeline picker for a new routine", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: /New Routine/ }));
    expect(screen.getByTestId("jobs-pipeline-picker")).toBeInTheDocument();

    await user.click(screen.getByTestId("jobs-pick-pipeline-1"));
    expect(screen.getByTestId("schedule-editor")).toBeInTheDocument();
  });
});
