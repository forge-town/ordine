import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Job, PipelineAsset, PipelineData } from "@repo/schemas";
import { render } from "@/test/test-wrapper";
import { SearchPipelineDialog } from "./SearchPipelineDialog";

const mockNavigate = vi.fn();
const mockSidebarStore = vi.hoisted(() => {
  type SearchState = {
    searchOpen: boolean;
    sidebarSearchQuery: string;
    handleSearchDialogOpenChange: (open: boolean) => void;
    handleSidebarSearchChange: (value: string) => void;
    handleSidebarSearchClear: () => void;
  };

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const store = {
    state: {} as SearchState,
    getInitialState: () => store.state,
    getState: () => store.state,
    setState: (patch: Partial<SearchState>) => {
      store.state = { ...store.state, ...patch };
      notify();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
  store.state = {
    searchOpen: false,
    sidebarSearchQuery: "",
    handleSearchDialogOpenChange: (open) => store.setState({ searchOpen: open }),
    handleSidebarSearchChange: (value) =>
      store.setState({ searchOpen: value.trim().length > 0, sidebarSearchQuery: value }),
    handleSidebarSearchClear: () => store.setState({ searchOpen: false, sidebarSearchQuery: "" }),
  };

  return store;
});
const now = new Date("2026-06-10T10:00:00.000Z");
const mockData: {
  assets: PipelineAsset[];
  jobs: Job[];
  pipelines: PipelineData[];
} = {
  assets: [],
  jobs: [],
  pipelines: [],
};

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("@/store/sidebarStore", () => ({
  useSidebarStore: () => mockSidebarStore,
}));

vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: {
    jobs: "jobs",
    pipelineAssets: "pipelineAssets",
    pipelines: "pipelines",
  },
}));

vi.mock("@refinedev/core", () => ({
  useList: ({ resource }: { resource: string }) => {
    if (resource === "pipelines") {
      return { result: { data: mockData.pipelines }, query: { isLoading: false } };
    }
    if (resource === "pipelineAssets") {
      return { result: { data: mockData.assets }, query: { isLoading: false } };
    }
    if (resource === "jobs") {
      return { result: { data: mockData.jobs }, query: { isLoading: false } };
    }

    return { result: { data: [] }, query: { isLoading: false } };
  },
}));

const renderDialog = () => render(<SearchPipelineDialog />);

beforeEach(() => {
  vi.clearAllMocks();
  mockSidebarStore.setState({ searchOpen: true, sidebarSearchQuery: "lead" });
  mockData.pipelines = [
    {
      id: "pipeline-1",
      projectId: null,
      status: "ready",
      name: "Lead Research Brief",
      description: "Summarize lead profile",
      tags: [],
      timeoutMs: null,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
  mockData.assets = [
    {
      id: "asset-1",
      pipelineId: "pipeline-1",
      name: "Lead Enrichment Component",
      description: "Reusable enrichment flow",
      snapshotNodes: [],
      snapshotEdges: [],
      inputSlots: [{ nodeId: "input", label: "lead", acceptTypes: ["json"] }],
      totalRuns: 2,
      successRate: 1,
      avgDurationMs: 1200,
      tags: ["crm"],
      createdAt: now,
      updatedAt: now,
    },
  ];
  mockData.jobs = [
    {
      id: "job-1",
      title: "Lead sync job",
      type: "pipeline_run",
      status: "running",
      parentJobId: null,
      pipelineId: "pipeline-1",
      projectId: null,
      totalTokens: null,
      totalCost: null,
      nodeStatuses: null,
      error: null,
      startedAt: now,
      finishedAt: null,
      meta: { createdAt: now, updatedAt: now },
    },
  ];
});

describe("SearchPipelineDialog", () => {
  it("renders pipeline, component, and job result groups", () => {
    renderDialog();

    expect(screen.getByText("Pipelines")).toBeInTheDocument();
    expect(screen.getByText("Lead Research Brief")).toBeInTheDocument();
    expect(screen.getByText("Components")).toBeInTheDocument();
    expect(screen.getByText("Lead Enrichment Component")).toBeInTheDocument();
    expect(screen.getByText("Jobs")).toBeInTheDocument();
    expect(screen.getByText("Lead sync job")).toBeInTheDocument();
  });

  it("navigates to a selected pipeline and clears sidebar search", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: /Lead Research Brief/ }));

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/canvas", search: { id: "pipeline-1" } });
    expect(mockSidebarStore.getState().searchOpen).toBe(false);
    expect(mockSidebarStore.getState().sidebarSearchQuery).toBe("");
  });
});
