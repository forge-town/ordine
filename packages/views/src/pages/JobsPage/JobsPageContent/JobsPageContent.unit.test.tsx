import type * as RefineCore from "@refinedev/core";
import type * as Router from "@tanstack/react-router";
import {
  ExecutionJobSummarySchema,
  ExecutionJobSchema,
  type ExecutionJobSummary,
  type PipelineData,
  type Routine,
  type RoutineOccurrence,
} from "@repo/schemas";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "../../../test/test-wrapper";
import { JobsPageStoreProvider } from "../_store";
import { JobsPageContent } from "./JobsPageContent";

const { mockData, mockMutateAsync, mockNavigate, mockRefetchJobs, mockList } = vi.hoisted(() => ({
  mockData: {
    jobs: [] as ExecutionJobSummary[],
    pipelines: [] as PipelineData[],
    routines: [] as Routine[],
    occurrences: [] as RoutineOccurrence[],
    error: null as Error | null,
  },
  mockMutateAsync: vi.fn(),
  mockNavigate: vi.fn(),
  mockRefetchJobs: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof Router>()),
  useNavigate: () => mockNavigate,
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useCreate: () => ({ mutateAsync: mockMutateAsync, mutation: { isPending: false } }),
  useOne: ({ id }: { id: string }) => ({
    result: mockData.jobs.find((job) => job.id === id),
    query: { isError: false, refetch: mockRefetchJobs },
  }),
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
  useList: (params: { resource: string; dataProviderName?: string }) => {
    mockList(params);
    const { resource } = params;
    const data =
      resource === "job-summaries"
        ? mockData.jobs
        : resource === "routines"
          ? mockData.routines
          : resource === "pipelines"
            ? mockData.pipelines
            : [];

    return {
      query: {
        isLoading: false,
        isError: resource === "job-summaries" && Boolean(mockData.error),
        error: mockData.error,
        refetch: resource === "job-summaries" ? mockRefetchJobs : vi.fn(),
      },
      result: { data, total: data.length },
    };
  },
}));
vi.mock("../../../components/ExecutionRequest/ExecutionJobCard", () => ({
  ExecutionJobCard: ({ jobId }: { jobId: string }) => (
    <div data-testid="execution-job-card">{jobId}</div>
  ),
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
  mockData.error = null;
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
  mockData.jobs = ["running", "waiting_for_input"].map((state, index) =>
    ExecutionJobSummarySchema.parse({
      apiVersion: 2,
      id: `job-${index + 1}`,
      preparedRunId: `prepared-${index + 1}`,
      revision: 1,
      state,
      pipelineId: "pipeline-1",
      pipelineName: "Approved Release Snapshot",
      pipelineRevision: 3,
      requestId: `11111111-1111-4111-8111-11111111111${index + 1}`,
      createdAt: now.toISOString(),
      startedAt: now.toISOString(),
      finishedAt: null,
      deadlineAt: null,
      waitingDeadlineAt: null,
      stopReason: null,
      error: null,
      warnings: [],
    }),
  );
  mockMutateAsync.mockResolvedValue({
    data: ExecutionJobSchema.strip().parse({ ...mockData.jobs[0], state: "pausing" }),
  });
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
  it("restores a failed control action so the user can explicitly retry", async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockRejectedValueOnce(new Error("Control denied"));
    renderContent();
    const button = screen.getByTestId("jobs-action-pause-job-1");
    await user.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(mockMutateAsync).toHaveBeenCalledTimes(1);
    expect(mockRefetchJobs).not.toHaveBeenCalled();
    await user.click(button);
    await waitFor(() => expect(mockRefetchJobs).toHaveBeenCalledOnce());
    expect(mockMutateAsync).toHaveBeenCalledTimes(2);
  });
  it("loads the named v2 projection and shows frozen names instead of current author names", () => {
    renderContent();
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ dataProviderName: "execution", resource: "job-summaries" }),
    );
    expect(mockList).not.toHaveBeenCalledWith(expect.objectContaining({ resource: "jobs" }));
    expect(screen.getAllByText("Approved Release Snapshot")).toHaveLength(2);
    expect(screen.queryByText("Release Review")).not.toBeInTheDocument();
    expect(screen.queryByText("1.2k")).not.toBeInTheDocument();
  });

  it("opens the original drawer with the v2 Job card", async () => {
    const user = userEvent.setup();
    renderContent();
    await user.click(screen.getByTestId("jobs-action-review-job-2"));
    expect(screen.getByTestId("job-detail-drawer")).toBeInTheDocument();
    expect(screen.getByTestId("execution-job-card")).toHaveTextContent("job-2");
  });

  it("opens Canvas for a new request instead of submitting a rerun", async () => {
    mockData.jobs[0]!.state = "succeeded";
    const user = userEvent.setup();
    renderContent();
    await user.click(screen.getByTestId("jobs-action-rerun-job-1"));
    expect(mockNavigate).toHaveBeenCalledWith({ to: "/canvas", search: { id: "pipeline-1" } });
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("displays read errors and provides a retry instead of an empty success state", async () => {
    mockData.error = new Error("execution permission denied");
    const user = userEvent.setup();
    renderContent();
    expect(screen.getByRole("alert")).toHaveTextContent("execution permission denied");
    await user.click(screen.getByRole("button", { name: "重新加载" }));
    expect(mockRefetchJobs).toHaveBeenCalledOnce();
  });
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
        dataProviderName: "execution",
        resource: "job-control",
        values: { jobId: "job-1", action: "pause" },
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
