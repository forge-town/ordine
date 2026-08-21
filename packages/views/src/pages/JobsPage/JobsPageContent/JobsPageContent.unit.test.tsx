import type * as RefineCore from "@refinedev/core";
import type { Job, PipelineData, Routine, RoutineOccurrence } from "@repo/schemas";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../../test/test-wrapper";
import { JobsPageStoreProvider } from "../_store";
import { JobsPageContent } from "./JobsPageContent";

const { mockData, mockMutateAsync, mockNavigate, mockRefetchJobs } = vi.hoisted(() => ({
  mockData: {
    jobs: [] as Job[],
    pipelines: [] as PipelineData[],
    routines: [] as Routine[],
    occurrences: [] as RoutineOccurrence[],
  },
  mockMutateAsync: vi.fn(),
  mockNavigate: vi.fn(),
  mockRefetchJobs: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useCustomMutation: () => ({ mutateAsync: mockMutateAsync }),
  useCustom: () => ({
    query: { isLoading: false },
    result: {
      data: {
        occurrences: mockData.occurrences,
        timeZone: "UTC",
        truncated: false,
      },
    },
  }),
  useList: ({ resource }: { resource: string }) => {
    const data =
      resource === "jobs"
        ? mockData.jobs
        : resource === "routines"
          ? mockData.routines
          : resource === "pipelines"
            ? mockData.pipelines
            : [];

    return {
      query: {
        isLoading: false,
        refetch: resource === "jobs" ? mockRefetchJobs : vi.fn(),
      },
      result: { data, total: data.length },
    };
  },
}));

const now = new Date();
const secondOccurrenceAt = new Date(now.getTime() + 2 * 60 * 60_000);

const renderContent = () =>
  render(
    <JobsPageStoreProvider>
      <JobsPageContent />
    </JobsPageStoreProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockMutateAsync.mockResolvedValue({ data: { id: "job-1", status: "paused" } });
  mockData.pipelines = [
    {
      id: "pipeline-1",
      name: "Release Review",
      description: "",
      sharedContext: "",
      tags: [],
      nodes: [],
      edges: [],
      timeoutMs: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  mockData.jobs = [
    {
      id: "job-1",
      title: "Pipeline run",
      status: "running",
      type: "pipeline_run",
      parentJobId: null,
      pipelineId: "pipeline-1",
      error: null,
      startedAt: now,
      finishedAt: null,
      totalTokens: 1_200,
    },
    {
      id: "job-2",
      title: "Approval run",
      status: "running",
      type: "pipeline_run",
      parentJobId: null,
      pipelineId: "pipeline-1",
      error: null,
      startedAt: now,
      finishedAt: null,
      nodeStatuses: { approval: "waitingForUser" },
    },
  ];
  mockData.routines = [
    {
      id: "routine-1",
      pipelineId: "pipeline-1",
      name: "Daily review",
      description: null,
      cronExpression: "0 * * * *",
      inputConfig: null,
      enabled: true,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "routine-2",
      pipelineId: "pipeline-1",
      name: "Weekday review",
      description: null,
      cronExpression: "30 16 * * 1-5",
      inputConfig: null,
      enabled: true,
      lastRunAt: null,
      nextRunAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  mockData.occurrences = [
    {
      aggregated: true,
      at: new Date(now.getTime() + 60 * 60_000).toISOString(),
      routineId: "routine-1",
    },
    {
      aggregated: false,
      at: secondOccurrenceAt.toISOString(),
      routineId: "routine-2",
    },
  ];
});

describe("JobsPageContent", () => {
  it("renders current jobs and flags work waiting for review", () => {
    renderContent();

    expect(screen.getByTestId("jobs-toolbar")).toHaveClass("gap-3", "px-4", "pb-3.5");
    expect(screen.getByTestId("jobs-toolbar")).not.toHaveClass("border-b");
    expect(screen.queryByTestId("jobs-summary")).not.toBeInTheDocument();
    expect(screen.getByTestId("jobs-table")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-table-row-job-1")).toBeInTheDocument();
    expect(screen.getByTestId("jobs-action-review-job-2")).toBeInTheDocument();
  });

  it("routes row controls through the named endpoint and refreshes jobs", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByTestId("jobs-action-pause-job-1"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        method: "post",
        url: "jobs/pause",
        values: { jobId: "job-1" },
      });
      expect(mockRefetchJobs).toHaveBeenCalledOnce();
    });
  });

  it("switches to the calendar and renders server-expanded routines", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByTestId("jobs-view-calendar"));

    expect(screen.getByTestId("jobs-calendar")).toBeInTheDocument();
    expect(screen.getAllByText("Daily review").length).toBeGreaterThan(0);
    expect(screen.getByTestId("jobs-calendar-condensed")).toBeInTheDocument();
  });

  it("opens the exact routine selected from the calendar", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByTestId("jobs-view-calendar"));
    await user.click(
      screen.getByTestId(`jobs-calendar-block-ghost-routine-2-${secondOccurrenceAt.getTime()}`),
    );

    expect(screen.getByTestId("schedule-routine-select")).toHaveValue("routine-2");
  });
});
