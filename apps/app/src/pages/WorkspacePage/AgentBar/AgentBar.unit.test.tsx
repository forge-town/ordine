import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job, PipelineAsset } from "@repo/schemas";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { CanvasPageStoreContext, createCanvasPageStore } from "@/pages/CanvasPage/_store";
import { useWorkspaceStore } from "../_store/workspaceStore";
import { useAgentBarStore } from "./_store";
import { AgentBar, WORKSPACE_PHASES } from "./AgentBar";

const { mockNavigate, mockRefetchJob, mockUseListData, mockUseOneData } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockRefetchJob: vi.fn(),
  mockUseListData: vi.fn<() => PipelineAsset[]>(() => []),
  mockUseOneData: vi.fn<() => Job | null>(() => null),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: {
      data: mockUseListData(),
    },
  }),
  useOne: () => ({
    query: {
      data: mockUseOneData() ? { data: mockUseOneData() } : undefined,
      refetch: mockRefetchJob,
    },
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("./useAgentConversation", () => ({
  useAgentConversation: () => ({
    applyProposal: vi.fn(),
    diagnostics: null,
    hasBlockingDiagnostics: false,
    isSending: false,
    pendingProposal: null,
    proposalItems: [],
    rejectProposal: vi.fn(),
    reviseProposal: vi.fn(),
    submitMessage: vi.fn(),
  }),
}));

const renderAgentBar = (
  handleCollapse = vi.fn(),
  setup?: (store: ReturnType<typeof createCanvasPageStore>) => void,
) => {
  const canvasStore = createCanvasPageStore(
    [
      {
        id: "load",
        type: "folder",
        position: { x: 0, y: 0 },
        data: { label: "Load PDFs", nodeType: "folder", folderPath: "/tmp/pdfs" },
      },
      {
        id: "quiz",
        type: "operation",
        position: { x: 0, y: 0 },
        data: {
          label: "Generate Quiz",
          nodeType: "operation",
          operationId: "op-quiz",
          operationName: "Generate Quiz",
          status: "idle",
        },
      },
    ],
    [],
    "pipe-test",
    "Pipeline",
  );
  setup?.(canvasStore);
  render(
    <CanvasPageStoreContext.Provider value={canvasStore}>
      <AgentBar pipelineId="pipe-test" onCollapse={handleCollapse} />
    </CanvasPageStoreContext.Provider>,
  );

  return { handleCollapse };
};

describe("AgentBar", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().resetWorkspace();
    useAgentBarStore.getState().resetAgentBar();
    mockNavigate.mockClear();
    mockRefetchJob.mockClear();
    mockRefetchJob.mockResolvedValue({});
    mockUseListData.mockReturnValue([]);
    mockUseOneData.mockReturnValue(null);
    vi.spyOn(dataProvider, "custom").mockResolvedValue({ data: {} });
  });

  it("renders the header, context tags, and empty phase body", () => {
    renderAgentBar();

    expect(screen.getByTestId("workspace-agent-bar")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText(/New canvas · no pipeline yet/)).toBeInTheDocument();
    expect(screen.getByText("empty")).toBeInTheDocument();
    expect(screen.getByText("Turn my textbook PDFs into a Notion quiz")).toBeInTheDocument();
  });

  it("switches all phases from the dev phase controls", async () => {
    const user = userEvent.setup();
    renderAgentBar();

    for (const phase of WORKSPACE_PHASES) {
      await user.click(screen.getByRole("button", { name: phase }));
      expect(useWorkspaceStore.getState().phase).toBe(phase);
    }

    expect(screen.getByText(/Run complete · asset saved/)).toBeInTheDocument();
  });

  it("renders conversation messages after the scripted phase body", () => {
    useAgentBarStore.getState().addMessage({
      content: "Please make the quiz harder.",
      id: "m1",
      role: "user",
    });
    useAgentBarStore.getState().addMessage({
      content: "I will tighten the distractors.",
      id: "m2",
      role: "assistant",
    });

    renderAgentBar();

    expect(screen.getByText("Please make the quiz harder.")).toBeInTheDocument();
    expect(screen.getByText("I will tighten the distractors.")).toBeInTheDocument();
  });

  it("renders live run status from the active job", () => {
    useWorkspaceStore.getState().setPhase("running");
    mockUseOneData.mockReturnValue({
      id: "job-live",
      title: "Pipeline run",
      type: "pipeline_run",
      status: "running",
      parentJobId: null,
      error: null,
      startedAt: new Date("2026-06-10T10:00:00.000Z"),
      finishedAt: null,
      totalCost: "0.4200",
      nodeStatuses: {
        load: "done",
        quiz: "running",
      },
      meta: {
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:05.000Z"),
      },
    } satisfies Job);

    renderAgentBar(vi.fn(), (store) => {
      store.setState({
        activeJobId: "job-live",
        nodeRunStatuses: {
          load: "done",
          quiz: "running",
        },
      });
    });

    expect(screen.getByText(/Watching · job-live · live/)).toBeInTheDocument();
    expect(screen.getByText("Running - job-live")).toBeInTheDocument();
    expect(screen.getByText("Step 2 of 2 - Generate Quiz")).toBeInTheDocument();
    expect(screen.getByText(/\$0\.42/)).toBeInTheDocument();
  });

  it("renders a failure card from failed job data", () => {
    useWorkspaceStore.getState().setPhase("running");
    mockUseOneData.mockReturnValue({
      id: "job-failed",
      title: "Pipeline run",
      type: "pipeline_run",
      status: "failed",
      parentJobId: null,
      error: "Connector token missing",
      startedAt: new Date("2026-06-10T10:00:00.000Z"),
      finishedAt: new Date("2026-06-10T10:00:04.000Z"),
      totalCost: "0.0000",
      nodeStatuses: {
        load: "done",
        quiz: "failed",
      },
      meta: {
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:04.000Z"),
      },
    } satisfies Job);

    renderAgentBar(vi.fn(), (store) => {
      store.setState({
        activeJobId: "job-failed",
        nodeRunStatuses: {
          load: "done",
          quiz: "failed",
        },
      });
    });

    expect(screen.getByText("Failed - job-failed")).toBeInTheDocument();
    expect(screen.getByText("Run failed - Generate Quiz")).toBeInTheDocument();
    expect(screen.getByText(/Connector token missing/)).toBeInTheDocument();
  });

  it("renders self-heal steps from job traces", async () => {
    vi.mocked(dataProvider.custom!).mockResolvedValue({
      data: {
        traces: [
          { message: "@@SELF_HEAL_DONE::quiz::1" },
          { message: "@@SELF_HEAL::quiz::1::Retrying after failure: timeout" },
        ],
      },
    });
    useWorkspaceStore.getState().setPhase("running");
    mockUseOneData.mockReturnValue({
      id: "job-healed",
      title: "Pipeline run",
      type: "pipeline_run",
      status: "failed",
      parentJobId: null,
      error: "Still failed downstream",
      startedAt: new Date("2026-06-10T10:00:00.000Z"),
      finishedAt: new Date("2026-06-10T10:00:04.000Z"),
      totalCost: "0.0000",
      nodeStatuses: {
        load: "done",
        quiz: "failed",
      },
      meta: {
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:04.000Z"),
      },
    } satisfies Job);

    renderAgentBar(vi.fn(), (store) => {
      store.setState({
        activeJobId: "job-healed",
        nodeRunStatuses: {
          load: "done",
          quiz: "failed",
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Self-heal/)).toBeInTheDocument();
    });
    const user = userEvent.setup();
    await user.click(screen.getByTestId("agent-self-heal-toggle"));
    expect(screen.getByText(/Retry 1 for quiz/)).toBeInTheDocument();
    expect(screen.getByText(/Node quiz recovered/)).toBeInTheDocument();
  });

  it("renders checkpoint controls and resumes a waiting job", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.getState().setPhase("running");
    mockUseOneData.mockReturnValue({
      id: "job-waiting",
      title: "Pipeline run",
      type: "pipeline_run",
      status: "running",
      parentJobId: null,
      error: null,
      startedAt: new Date("2026-06-10T10:00:00.000Z"),
      finishedAt: null,
      totalCost: "0.0000",
      nodeStatuses: {
        load: "done",
        quiz: "waitingForUser",
      },
      meta: {
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:04.000Z"),
      },
    } satisfies Job);

    renderAgentBar(vi.fn(), (store) => {
      store.setState({
        activeJobId: "job-waiting",
        nodeRunStatuses: {
          load: "done",
          quiz: "waitingForUser",
        },
      });
    });

    expect(screen.getByText(/Checkpoint · paused at Generate Quiz/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Resume" }));

    expect(dataProvider.custom).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { jobId: "job-waiting" },
        url: "jobs/resume",
      }),
    );
    expect(mockRefetchJob).toHaveBeenCalled();
  });

  it("renders distilled asset and opens Components", async () => {
    const user = userEvent.setup();
    useWorkspaceStore.getState().setPhase("done");
    mockUseListData.mockReturnValue([
      {
        id: "asset-1",
        pipelineId: "pipe-test",
        name: "Quiz Pipeline",
        description: "",
        snapshotNodes: [],
        snapshotEdges: [],
        inputSlots: [],
        totalRuns: 1,
        successRate: 1,
        avgDurationMs: 1200,
        tags: [],
        createdAt: new Date("2026-06-10T10:00:00.000Z"),
        updatedAt: new Date("2026-06-10T10:00:00.000Z"),
      },
    ]);

    renderAgentBar();

    expect(screen.getByText(/Distilled to Components/)).toBeInTheDocument();

    await user.click(screen.getByTestId("agent-distill"));

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/components" });
  });

  it("calls collapse handler from the header button", async () => {
    const user = userEvent.setup();
    const handleCollapse = vi.fn();
    renderAgentBar(handleCollapse);

    await user.click(screen.getByRole("button", { name: "Collapse Agent Bar" }));

    expect(handleCollapse).toHaveBeenCalledTimes(1);
  });
});
