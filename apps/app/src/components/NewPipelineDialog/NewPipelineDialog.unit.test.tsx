import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewPipelineDialog } from "./NewPipelineDialog";
import { SidebarStoreContext, createSidebarStore, type SidebarStore } from "@/store/sidebarStore";

const mockCreateSession = vi.fn();
const mockAppendMessage = vi.fn();
const mockUploadAttachment = vi.fn();
const mockPlanSessionStream = vi.fn();
const mockGetLatestReadyProposal = vi.fn();
const mockGetLatestAssistantQuestion = vi.fn();
const mockApproveProposal = vi.fn();
const mockSupersedeProposal = vi.fn();
const mockGeneratePipeline = vi.fn();
const mockWaitForCreatedPipeline = vi.fn();
const mockRunMutate = vi.fn();
const mockNavigate = vi.fn();
const mockMaterializeGeneratedPipeline = vi.fn();

vi.mock("@/lib/pipelineAgentSessionsClient", () => ({
  pipelineAgentSessionsClient: {
    appendMessage: (...args: unknown[]) => mockAppendMessage(...args),
    approveProposal: (...args: unknown[]) => mockApproveProposal(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    getLatestAssistantQuestion: (...args: unknown[]) => mockGetLatestAssistantQuestion(...args),
    generatePipelineFromApprovedProposal: (...args: unknown[]) => mockGeneratePipeline(...args),
    getLatestReadyProposal: (...args: unknown[]) => mockGetLatestReadyProposal(...args),
    supersedeProposal: (...args: unknown[]) => mockSupersedeProposal(...args),
    waitForCreatedPipeline: (...args: unknown[]) => mockWaitForCreatedPipeline(...args),
    planSessionStream: (...args: unknown[]) => mockPlanSessionStream(...args),
    uploadAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
  },
}));

vi.mock("@/lib/materializeGeneratedPipeline", () => ({
  materializeGeneratedPipeline: (...args: unknown[]) => mockMaterializeGeneratedPipeline(...args),
}));

vi.mock("@/integrations/refine/dataProvider", () => ({
  dataProvider: {
    custom: (params: { url: string; payload: unknown }) => {
      if (params.url === "pipelines/run") {
        return mockRunMutate(params.payload);
      }

      return Promise.resolve({ data: {} });
    },
  },
  ResourceName: {
    pipelines: "pipelines",
  },
}));

vi.mock("@/router", () => ({
  router: { navigate: (...args: unknown[]) => mockNavigate(...args) },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

vi.mock("@/lib/i18n", () => ({
  default: { t: (key: string) => key },
}));

vi.mock("@repo/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogHeader: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <h2 className={className}>{children}</h2>
  ),
  DialogDescription: ({ children }: React.PropsWithChildren) => <p>{children}</p>,
  DialogFooter: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("@repo/ui/button", () => ({
  Button: ({ children, onClick: handleClick, disabled, type }: React.ComponentProps<"button">) => (
    <button disabled={disabled} type={type} onClick={handleClick}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

vi.mock("@repo/ui/textarea", () => ({
  Textarea: (props: React.ComponentProps<"textarea">) => <textarea {...props} />,
}));

vi.mock("@repo/ui/badge", () => ({
  Badge: ({ children }: React.PropsWithChildren) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@repo/ui/form", () => ({
  Form: ({ children }: React.PropsWithChildren) => <form>{children}</form>,
  FormField: ({
    render: renderField,
    name,
  }: {
    name: string;
    render: (props: {
      field: { name: string; value: string; onChange: () => void };
    }) => React.ReactNode;
  }) => renderField({ field: { name, value: "", onChange: () => undefined } }),
  FormItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  FormControl: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  AlertCircle: () => <span data-testid="alert-circle-icon" />,
  ArrowLeft: () => <span data-testid="arrow-left-icon" />,
  ArrowUp: () => <span data-testid="arrow-up-icon" />,
  CheckCircle2: () => <span data-testid="check-icon" />,
  ExternalLink: () => <span data-testid="external-link-icon" />,
  Loader2: () => <span data-testid="loader" />,
  Paperclip: () => <span data-testid="paperclip-icon" />,
  Play: () => <span data-testid="play-icon" />,
  Plus: () => <span data-testid="plus-icon" />,
  Sparkles: () => <span data-testid="sparkles-icon" />,
  Square: () => <span data-testid="square-icon" />,
  Upload: () => <span data-testid="upload-icon" />,
  WandSparkles: () => <span data-testid="wand-sparkles-icon" />,
  Workflow: () => <span data-testid="workflow-icon" />,
  X: () => <span data-testid="x-icon" />,
}));

const createWrapper = (store: SidebarStore) => {
  return ({ children }: React.PropsWithChildren) => (
    <SidebarStoreContext.Provider value={store}>{children}</SidebarStoreContext.Provider>
  );
};

describe("NewPipelineDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateSession.mockResolvedValue({
      id: "session-1",
      entrypoint: "new-pipeline-dialog",
      mode: "generate",
      status: "draft",
    });
    mockAppendMessage.mockResolvedValue({
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      kind: "text",
      content: "Build me a review pipeline",
    });
    mockUploadAttachment.mockResolvedValue({
      attachment: {
        id: "attachment-1",
        filename: "brief.txt",
        parseStatus: "parsed",
      },
    });
    mockApproveProposal.mockResolvedValue(undefined);
    mockSupersedeProposal.mockResolvedValue(undefined);
    mockGeneratePipeline.mockResolvedValue({ pipelineId: "pipe-1" });
    mockMaterializeGeneratedPipeline.mockResolvedValue("pipe-1");
    mockGetLatestAssistantQuestion.mockResolvedValue(null);
    mockGetLatestReadyProposal.mockResolvedValue(null);
    mockWaitForCreatedPipeline.mockResolvedValue({ pipelineId: "pipe-1" });
    mockRunMutate.mockResolvedValue({ data: {} });
  });

  it("does not render when dialog is closed", () => {
    const store = createSidebarStore();
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });

  it("renders conversation composer when dialog is open", () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByText("nav.newPipeline")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.send")).toBeInTheDocument();
  });

  it("creates a session, sends a message, and displays a streamed follow-up question", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({ type: "phase", phase: "planning" });
      onEvent({ type: "question", question: "What output format do you want?" });
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const textarea = screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder");
    await userEvent.type(textarea, "Build me a review pipeline");
    await userEvent.click(screen.getByText("newPipelineDialog.send"));

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith(
        {
          entrypoint: "new-pipeline-dialog",
          mode: "generate",
        },
        { signal: expect.any(AbortSignal) },
      );
    });
    expect(mockAppendMessage).toHaveBeenCalledWith(
      "session-1",
      {
        role: "user",
        kind: "text",
        content: "Build me a review pipeline",
      },
      { signal: expect.any(AbortSignal) },
    );
    expect(mockPlanSessionStream).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("What output format do you want?")).toBeInTheDocument();
    });
  });

  it("renders a proposal review after streamed proposal_ready", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));

    await waitFor(() => {
      expect(screen.getByText("Review repository code")).toBeInTheDocument();
    });
    expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.revise")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.reject")).toBeInTheDocument();
  });

  it("renders a proposal review from session fallback when the stream misses proposal_ready", async () => {
    mockPlanSessionStream.mockResolvedValue(undefined);
    mockGetLatestReadyProposal.mockResolvedValueOnce({
      proposal: {
        mode: "generate",
        purpose: "Review repository code",
        inputs: ["folder"],
        outputs: ["markdown report"],
        majorOperations: ["review-code"],
        executionFlow: ["folder -> review-code -> output"],
        assumptions: [],
        openQuestions: [],
        readiness: "ready_for_generation",
      },
      proposalId: "proposal-1",
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));

    await waitFor(() => {
      expect(mockGetLatestReadyProposal).toHaveBeenCalledWith("session-1", "generate", {
        excludeProposalId: null,
        signal: expect.any(AbortSignal),
      });
      expect(screen.getByText("Review repository code")).toBeInTheDocument();
    });
    expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
  });

  it("supersedes the active proposal when rejecting it", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.reject")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.reject"));

    await waitFor(() => {
      expect(mockSupersedeProposal).toHaveBeenCalledWith("session-1", "proposal-1");
    });
    expect(screen.queryByText("Review repository code")).not.toBeInTheDocument();
  });

  it("supersedes the active proposal when revising it", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.revise")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.revise"));

    await waitFor(() => {
      expect(mockSupersedeProposal).toHaveBeenCalledWith("session-1", "proposal-1");
    });
    expect(screen.queryByText("Review repository code")).not.toBeInTheDocument();
  });

  it("does not resurrect a rejected proposal in session fallback", async () => {
    const superseded = { current: false };
    const proposalResult = {
      proposal: {
        mode: "generate" as const,
        purpose: "Review repository code",
        inputs: ["folder"],
        outputs: ["markdown report"],
        majorOperations: ["review-code"],
        executionFlow: ["folder -> review-code -> output"],
        assumptions: [],
        openQuestions: [],
        readiness: "ready_for_generation" as const,
      },
      proposalId: "proposal-1",
    };
    mockSupersedeProposal.mockImplementation(async () => {
      superseded.current = true;
    });
    mockPlanSessionStream
      .mockImplementationOnce(async (_sessionId, { onEvent }) => {
        onEvent({ type: "proposal_ready", ...proposalResult });
      })
      .mockResolvedValueOnce(undefined);
    mockGetLatestReadyProposal.mockImplementation(async () =>
      superseded.current ? null : proposalResult,
    );

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.reject")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.reject"));
    await waitFor(() => {
      expect(mockSupersedeProposal).toHaveBeenCalledWith("session-1", "proposal-1");
    });
    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Try a different flow",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));

    await waitFor(() => {
      expect(mockGetLatestReadyProposal).toHaveBeenCalled();
    });
    expect(screen.queryByText("Review repository code")).not.toBeInTheDocument();
  });

  it("renders a follow-up question from session fallback when the stream misses question", async () => {
    mockPlanSessionStream.mockResolvedValue(undefined);
    mockGetLatestAssistantQuestion.mockResolvedValueOnce({
      question: "Should I create placeholder operations for unavailable capabilities?",
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));

    await waitFor(() => {
      expect(mockGetLatestAssistantQuestion).toHaveBeenCalledWith("session-1", {
        signal: expect.any(AbortSignal),
      });
      expect(
        screen.getByText("Should I create placeholder operations for unavailable capabilities?"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("newPipelineDialog.send")).toBeInTheDocument();
  });

  it("approves a proposal, generates a pipeline draft, and shows success actions", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));

    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.approve"));

    await waitFor(() => {
      expect(mockApproveProposal).toHaveBeenCalledWith("session-1", "proposal-1", {
        signal: expect.any(AbortSignal),
      });
    });
    expect(mockGeneratePipeline).toHaveBeenCalledWith("session-1", {
      signal: expect.any(AbortSignal),
    });
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.pipelineReady")).toBeInTheDocument();
    });
    expect(screen.getByText("newPipelineDialog.openInCanvas")).toBeInTheDocument();
    expect(screen.getByText("newPipelineDialog.runNow")).toBeInTheDocument();
  });

  it("falls back to polling the session when generate request fails but session completion is observable", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });
    mockGeneratePipeline.mockRejectedValueOnce(new Error("pending"));
    mockWaitForCreatedPipeline.mockResolvedValueOnce({ pipelineId: "pipe-polled" });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.approve"));

    await waitFor(() => {
      expect(mockWaitForCreatedPipeline).toHaveBeenCalledWith("session-1", {
        signal: expect.any(AbortSignal),
      });
      expect(screen.getByText("newPipelineDialog.pipelineReady")).toBeInTheDocument();
    });
  });

  it("keeps proposal review visible when generation returns a terminal server error", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });
    mockGeneratePipeline.mockRejectedValueOnce(
      Object.assign(new Error("Agent returned invalid pipeline structure"), {
        code: "PIPELINE_AGENT_INVALID_STRUCTURE",
        status: 500,
      }),
    );

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.approve"));

    await waitFor(() => {
      expect(screen.getByText("pipelineAgentErrors.invalidStructure")).toBeInTheDocument();
      expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
    });
    expect(mockWaitForCreatedPipeline).not.toHaveBeenCalled();
    expect(screen.queryByText("newPipelineDialog.pipelineReady")).not.toBeInTheDocument();
  });

  it("can approve the same proposal again after a terminal generation error", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposal: {
          mode: "generate",
          purpose: "Review repository code",
          inputs: ["folder"],
          outputs: ["markdown report"],
          majorOperations: ["review-code"],
          executionFlow: ["folder -> review-code -> output"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
        },
        proposalId: "proposal-1",
      });
    });
    mockGeneratePipeline
      .mockRejectedValueOnce(
        Object.assign(new Error("Agent returned invalid pipeline structure"), {
          code: "PIPELINE_AGENT_INVALID_STRUCTURE",
          status: 500,
        }),
      )
      .mockResolvedValueOnce({ pipelineId: "pipe-2" });

    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    await userEvent.type(
      screen.getByPlaceholderText("newPipelineDialog.messagePlaceholder"),
      "Build me a review pipeline",
    );
    await userEvent.click(screen.getByText("newPipelineDialog.send"));
    await waitFor(() => {
      expect(screen.getByText("newPipelineDialog.approve")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.approve"));
    await waitFor(() => {
      expect(screen.getByText("pipelineAgentErrors.invalidStructure")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("newPipelineDialog.approve"));

    await waitFor(() => {
      expect(mockApproveProposal).toHaveBeenCalledTimes(2);
      expect(mockGeneratePipeline).toHaveBeenCalledTimes(2);
      expect(screen.getByText("newPipelineDialog.pipelineReady")).toBeInTheDocument();
    });
  });

  it("uploads a file into the session context", async () => {
    const store = createSidebarStore();
    store.setState({ newPipelineOpen: true });
    render(<NewPipelineDialog />, { wrapper: createWrapper(store) });

    const file = new File(["hello"], "brief.txt", { type: "text/plain" });
    const input = screen.getByLabelText("newPipelineDialog.upload") as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
    expect(mockUploadAttachment).toHaveBeenCalledWith("session-1", file);
    await waitFor(() => {
      expect(screen.getByText("brief.txt")).toBeInTheDocument();
    });
  });
});
