import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JobsPageStoreProvider } from "../_store";
import { JobsPageContent } from "./JobsPageContent";
import type { Job, PipelineData, Routine } from "@repo/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

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
  useList: ({ resource }: { resource: string }) => {
    if (resource === "jobs") {
      return { result: { data: mockData.jobs }, query: { isLoading: false } };
    }
    if (resource === "routines") {
      return { result: { data: mockData.routines }, query: { isLoading: false } };
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
  mockData.pipelines = [
    {
      id: "pipeline-1",
      projectId: null,
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
      totalTokens: 51_000,
      totalCost: "0.18",
      nodeStatuses: { input: "done", research: "running", output: "idle" },
      error: null,
      startedAt: new Date(today.getTime() - 5000),
      finishedAt: null,
      meta: { createdAt: today, updatedAt: today },
    },
    {
      id: "job-002",
      title: "Queued review",
      status: "queued",
      type: "pipeline_run",
      parentJobId: null,
      pipelineId: "pipeline-1",
      projectId: null,
      totalTokens: null,
      totalCost: null,
      nodeStatuses: { checkpoint: "waitingForUser" },
      error: null,
      startedAt: null,
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
      cronExpression: "0 6 * * *",
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
  it("renders monitor header, stats, routines, and job rows", () => {
    renderContent();

    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
    expect(screen.getByText("Queued / Waiting")).toBeInTheDocument();
    expect(screen.getByText("Daily intake")).toBeInTheDocument();
    expect(screen.getAllByText("Lead Research Brief").length).toBeGreaterThan(0);
    expect(screen.getByText("Step 2/3 · research · running")).toBeInTheDocument();
  });

  it("filters jobs by chip and search", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: /Waiting/ }));
    expect(screen.queryByText("Step 2/3 · research · running")).not.toBeInTheDocument();
    expect(screen.getByText("Step 1/1 · checkpoint · waitingForUser")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("Search jobs..."), "missing");
    expect(screen.getByText("No matching jobs")).toBeInTheDocument();
  });

  it("updates routine enabled state from toggle", async () => {
    const user = userEvent.setup();
    renderContent();

    await user.click(screen.getByRole("button", { name: "Pause Daily intake" }));

    expect(mockUpdate).toHaveBeenCalledWith({
      resource: ResourceName.routines,
      id: "routine-1",
      values: { enabled: false },
    });
  });
});
