import { render } from "../../../test/test-wrapper";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPanel } from "./AgentPanel";
import {
  CanvasPageStoreContext,
  CanvasPageStoreProvider,
  createCanvasPageStore,
  useCanvasPageStore,
  type CanvasPageStore,
} from "../_store";
import { useRef, type ReactNode } from "react";
import type {
  AgentRuntimeConfig,
  PipelineActionProposal,
  PipelineActionDiagnostic,
} from "@repo/schemas";
import { ok } from "neverthrow";
import { AgentBarStoreProvider } from "./_store";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const mockApplyPipelineActions = vi.fn();
const mockScrollIntoView = vi.fn();
const mockGetOne = vi.fn();
const mockGetList = vi.fn();
const mockCreateSession = vi.fn();
const mockGetSessionById = vi.fn();
const mockAppendMessage = vi.fn();
const mockUploadAttachment = vi.fn();
const mockPlanSessionStream = vi.fn();
const mockGetLatestReadyProposal = vi.fn();
const mockGetLatestAssistantQuestion = vi.fn();
const mockApproveProposal = vi.fn();
const mockSupersedeProposal = vi.fn();

vi.mock("@repo/pipeline-engine/actions", () => ({
  applyPipelineActions: (...args: unknown[]) => mockApplyPipelineActions(...args),
}));

vi.mock("../../../lib/canvasDataProvider", () => ({
  setCanvasDataProvider: vi.fn(),
  getCanvasDataProvider: () => ({
    getOne: (...args: unknown[]) => mockGetOne(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
  }),
}));

vi.mock("../../../lib/pipelineAgentSessionsClient", () => ({
  createPipelineAgentSessionsClient: () => ({
    appendMessage: (...args: unknown[]) => mockAppendMessage(...args),
    approveProposal: (...args: unknown[]) => mockApproveProposal(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    getSessionById: (...args: unknown[]) => mockGetSessionById(...args),
    getLatestAssistantQuestion: (...args: unknown[]) => mockGetLatestAssistantQuestion(...args),
    getLatestReadyProposal: (...args: unknown[]) => mockGetLatestReadyProposal(...args),
    planSessionStream: (...args: unknown[]) => mockPlanSessionStream(...args),
    supersedeProposal: (...args: unknown[]) => mockSupersedeProposal(...args),
    uploadAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
  }),
}));

vi.mock("@repo/ui/button", () => ({
  Button: ({
    children,
    onClick: handleClick,
    disabled,
    title,
    className,
    variant,
    size,
    type,
    ...props
  }: React.ComponentProps<"button"> & { variant?: string; size?: string }) => (
    <button
      className={className}
      data-size={size}
      data-variant={variant}
      disabled={disabled}
      title={title}
      type={type}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/scroll-area", () => ({
  ScrollArea: ({
    children,
    className,
    ...props
  }: React.PropsWithChildren<React.ComponentProps<"div">>) => (
    <div className={className} {...props}>
      {children}
    </div>
  ),
}));

const wrapperWithoutPipeline = ({ children }: { children?: ReactNode }) => (
  <CanvasPageStoreProvider>{children}</CanvasPageStoreProvider>
);

const PanelActivator = ({
  children,
  isOpen = true,
  pendingProposal = null,
  diagnostics = null,
}: {
  children?: ReactNode;
  isOpen?: boolean;
  pendingProposal?: PipelineActionProposal | null;
  diagnostics?: PipelineActionDiagnostic[] | null;
}) => {
  const store = useCanvasPageStore();
  const initializedRef = useRef(false);
  if (!initializedRef.current) {
    initializedRef.current = true;
    store.setState({
      agentPanel: {
        isOpen,
        pendingProposal,
        diagnostics,
        isLoading: false,
      },
    });
  }

  return <>{children}</>;
};

const wrapperWithState = (
  props: {
    isOpen?: boolean;
    pendingProposal?: PipelineActionProposal | null;
    diagnostics?: PipelineActionDiagnostic[] | null;
  } = {},
) => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <CanvasPageStoreProvider
      pipeline={{ id: "pipe-1", name: "Test Pipeline", nodes: [], edges: [] }}
    >
      <PanelActivator {...props}>{children}</PanelActivator>
    </CanvasPageStoreProvider>
  );

  return Wrapper;
};

const wrapperWithMutableStore = () => {
  const store = createCanvasPageStore([], [], "pipe-1", "Test Pipeline");
  store.setState({
    agentPanel: {
      isOpen: true,
      pendingProposal: null,
      diagnostics: null,
      isLoading: false,
    },
  });
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <CanvasPageStoreContext.Provider value={store}>
      <AgentBarStoreProvider pipelineId="pipe-1">{children}</AgentBarStoreProvider>
    </CanvasPageStoreContext.Provider>
  );

  return { store: store as CanvasPageStore, Wrapper };
};

describe("AgentPanel", () => {
  beforeEach(() => {
    globalThis.sessionStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(globalThis.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: mockScrollIntoView,
    });
    mockGetOne.mockResolvedValue({
      data: { defaultAgentRuntime: "codex" },
    });
    mockGetList.mockResolvedValue({
      data: [
        {
          id: "runtime-codex",
          name: "Codex Local",
          type: "codex",
          connection: { mode: "local" },
        },
      ],
      total: 1,
    });
    mockCreateSession.mockResolvedValue({
      id: "session-1",
      entrypoint: "canvas-agent-panel",
      mode: "edit",
      status: "draft",
    });
    mockGetSessionById.mockResolvedValue(null);
    mockAppendMessage.mockResolvedValue({
      id: "message-1",
      sessionId: "session-1",
      role: "user",
      kind: "text",
      content: "Tighten the graph",
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
    mockGetLatestAssistantQuestion.mockResolvedValue(null);
    mockGetLatestReadyProposal.mockResolvedValue(null);
    mockApplyPipelineActions.mockReturnValue(ok({ nodes: [], edges: [] }));
  });

  it("renders panel with Alan-style empty guidance", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });
    expect(screen.getByText("canvas.agentPanel.title")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.empty.intro")).toBeInTheDocument();
    expect(screen.getByTestId("agent-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("agent-suggestions")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "canvas.agentPanel.empty.suggestQuiz" }),
    ).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.runtimeLabel")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "canvas.agentPanel.runtimeLabel" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel")).toHaveClass("bg-surface");
    expect(screen.getByTestId("canvas-agent-panel")).toHaveClass("h-full", "w-full");
    expect(screen.getByTestId("canvas-agent-panel-header")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel-header")).toHaveClass("px-3.5", "pb-2", "pt-3");
    expect(screen.getByTestId("canvas-agent-panel-messages")).toHaveClass(
      "min-h-0",
      "flex-1",
      "space-y-3.5",
      "overflow-y-auto",
      "px-4",
      "py-3",
    );
    await waitFor(() =>
      expect(screen.getByTestId("canvas-agent-panel-status-dot")).toHaveClass("bg-success"),
    );
    expect(screen.getByTestId("canvas-agent-panel-collapse")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-agent-panel-runtime-context")).toHaveClass(
      "h-auto",
      "w-fit",
      "rounded-none",
      "border-0",
      "bg-transparent",
    );
    expect(screen.getByPlaceholderText("workspace.agentBar.composer.placeholder")).toHaveClass(
      "bg-transparent",
    );
    expect(screen.getByTestId("agent-assistant")).toHaveClass("text-[12px]");
  });

  it("seeds the Composer for the reverse-engineering suggestion without sending", async () => {
    const user = userEvent.setup();
    render(<AgentPanel />, { wrapper: wrapperWithState() });

    await user.click(
      screen.getByRole("button", { name: "canvas.agentPanel.empty.suggestReverse" }),
    );

    expect(
      screen.getByRole("textbox", { name: "workspace.agentBar.composer.messageLabel" }),
    ).toHaveValue("canvas.agentPanel.empty.suggestReverse");
    expect(mockCreateSession).not.toHaveBeenCalled();
  });

  it("auto-sends the home prompt with the runtime selected on the home page", async () => {
    globalThis.sessionStorage.setItem(
      "ordine.pendingPipelinePrompt",
      JSON.stringify({ prompt: "Build an exam pipeline", runtimeId: "runtime-codex" }),
    );
    mockGetOne.mockResolvedValue({ data: { defaultAgentRuntime: "pi-agent" } });
    mockGetList.mockResolvedValue({
      data: [
        {
          id: "runtime-pi",
          name: "local-pi-agent",
          type: "pi-agent",
          connection: { mode: "local" },
        },
        {
          id: "runtime-codex",
          name: "Codex Local",
          type: "codex",
          connection: { mode: "local" },
        },
      ],
      total: 2,
    });
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({ type: "question", question: "Which exam sections?" });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });

    await waitFor(() =>
      expect(mockPlanSessionStream).toHaveBeenCalledWith(
        "session-1",
        expect.objectContaining({ runtimeId: "runtime-codex" }),
      ),
    );
    expect(mockAppendMessage).toHaveBeenCalledWith(
      "session-1",
      expect.objectContaining({ content: "Build an exam pipeline", role: "user" }),
    );
    expect(globalThis.sessionStorage.getItem("ordine.pendingPipelinePrompt")).toBeNull();
  });

  it("uses a neutral status when no runtime is selected", async () => {
    mockGetList.mockResolvedValueOnce({ data: [], total: 0 });

    render(<AgentPanel />, { wrapper: wrapperWithState() });

    await waitFor(() =>
      expect(screen.getByTestId("canvas-agent-panel-status-dot")).toHaveClass(
        "bg-muted-foreground/45",
      ),
    );
    expect(screen.getByTestId("canvas-agent-panel-status-dot")).not.toHaveClass("bg-success");
  });

  it("binds composer reference removal to the selected Canvas node", async () => {
    const { store, Wrapper } = wrapperWithMutableStore();
    store.setState({
      nodes: [
        {
          id: "node-1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "folder",
            label: "Input folder",
            folderPath: "/tmp/project",
          },
        },
      ] as never,
      selectedNodeId: "node-1",
    });

    render(<AgentPanel />, { wrapper: Wrapper });
    await userEvent.click(screen.getByTestId("ref-chip-remove-node-1"));

    expect(store.getState().selectedNodeId).toBeNull();
  });

  it("creates an edit session, sends a message, and displays a streamed follow-up question", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({ type: "phase", phase: "planning" });
      onEvent({ type: "question", question: "Which output node should receive the report?" });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    await userEvent.type(input, "Tighten the graph");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        entrypoint: "canvas-agent-panel",
        mode: "edit",
        pipelineId: "pipe-1",
        snapshot: { nodes: [], edges: [] },
      });
    });
    expect(mockAppendMessage).toHaveBeenCalledWith("session-1", {
      role: "user",
      kind: "text",
      content: "Tighten the graph",
    });
    await waitFor(() => {
      expect(screen.getByText("Which output node should receive the report?")).toBeInTheDocument();
    });
    expect(screen.getByText("Tighten the graph").closest("div")).toHaveClass("bg-foreground");
    expect(
      screen
        .getByText("Which output node should receive the report?")
        .closest('[data-testid="agent-assistant"]'),
    ).toHaveClass("text-[12px]");
  });

  it("deduplicates submits while runtime validation is in flight", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    let resolveRuntimeOptions!: (value: { data: AgentRuntimeConfig[]; total: number }) => void;
    mockGetList.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRuntimeOptions = resolve;
        }),
    );

    await userEvent.type(input, "Tighten the graph");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(2));
    resolveRuntimeOptions({
      data: [
        {
          id: "runtime-codex",
          name: "Codex Local",
          type: "codex",
          connection: { mode: "local" },
        },
      ],
      total: 1,
    });

    await waitFor(() => expect(mockCreateSession).toHaveBeenCalledTimes(1));
  });

  it("uploads a file into the edit session context", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    const file = new File(["hello"], "brief.txt", { type: "text/plain" });
    const input = screen.getByTestId("agent-composer-file-input") as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
    expect(mockUploadAttachment).toHaveBeenCalledWith("session-1", file, {
      runtimeId: "runtime-codex",
    });
    await waitFor(() => {
      expect(screen.getByText("brief.txt")).toBeInTheDocument();
    });
  });

  it("opens the file picker after session preparation without disabling the file input", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });

    const input = screen.getByTestId("agent-composer-file-input") as HTMLInputElement;
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "workspace.agentBar.composer.attach" }),
      ).toBeEnabled(),
    );
    const clickInput = vi.spyOn(input, "click");

    await userEvent.click(
      screen.getByRole("button", { name: "workspace.agentBar.composer.attach" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("agent-composer-attach-files")).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByTestId("agent-composer-attach-files"));

    await waitFor(() => expect(clickInput).toHaveBeenCalledTimes(1));
    expect(input).toBeEnabled();
  });

  it("blocks sending while an attachment upload is in flight", async () => {
    let resolveUpload: (value: {
      attachment: { filename: string; id: string; parseStatus: string };
    }) => void = () => undefined;
    mockUploadAttachment.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        }),
    );
    render(<AgentPanel />, { wrapper: wrapperWithState() });

    const uploadInput = screen.getByTestId("agent-composer-file-input");
    await waitFor(() => expect(uploadInput).toBeEnabled());
    await userEvent.upload(uploadInput, new File(["hello"], "brief.txt", { type: "text/plain" }));
    await waitFor(() => expect(mockUploadAttachment).toHaveBeenCalledTimes(1));

    const messageInput = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    expect(messageInput).toBeDisabled();
    fireEvent.keyDown(messageInput, { key: "Enter" });
    expect(mockPlanSessionStream).not.toHaveBeenCalled();

    resolveUpload({
      attachment: { filename: "brief.txt", id: "attachment-1", parseStatus: "parsed" },
    });
    await waitFor(() => expect(messageInput).toBeEnabled());
  });

  it("keeps send and upload controls disabled until history hydration completes", async () => {
    let resolveHistory: (value: { data: never[]; total: number }) => void = () => undefined;
    mockGetList.mockImplementation(({ resource }: { resource: string }) => {
      if (resource === "conversationMessages") {
        return new Promise<{ data: never[]; total: number }>((resolve) => {
          resolveHistory = resolve;
        });
      }

      return Promise.resolve({
        data: [
          {
            id: "runtime-codex",
            name: "Codex Local",
            type: "codex",
            connection: { mode: "local" },
          },
        ],
        total: 1,
      });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });

    expect(screen.getByPlaceholderText("workspace.agentBar.composer.placeholder")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "workspace.agentBar.composer.attach" }),
    ).toBeDisabled();

    resolveHistory({ data: [], total: 0 });
    await waitFor(() => {
      expect(screen.getByPlaceholderText("workspace.agentBar.composer.placeholder")).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "workspace.agentBar.composer.attach" }),
      ).toBeEnabled();
    });
  });

  it("clears uploaded attachments when graph signature changes", async () => {
    const { store, Wrapper } = wrapperWithMutableStore();
    render(<AgentPanel />, { wrapper: Wrapper });

    const file = new File(["hello"], "brief.txt", { type: "text/plain" });
    const uploadInput = screen.getByTestId("agent-composer-file-input");
    await waitFor(() => expect(uploadInput).toBeEnabled());
    await userEvent.upload(uploadInput, file);
    await waitFor(() => {
      expect(screen.getByText("brief.txt")).toBeInTheDocument();
    });

    store.setState({
      nodes: [
        {
          id: "node-1",
          type: "folder",
          position: { x: 0, y: 0 },
          data: {
            nodeType: "folder",
            label: "Folder",
            folderPath: "/tmp/project",
          },
        },
      ] as never,
    });

    await waitFor(() => {
      expect(screen.queryByText("brief.txt")).not.toBeInTheDocument();
      expect(screen.getByText("canvas.agentPanel.contextReset")).toBeInTheDocument();
    });
  });

  it("calls planning stream for edit proposals", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposalId: "proposal-1",
        proposal: {
          mode: "edit",
          summary: "Add a review operation",
          targetGraphIntent: "Insert a review step before output",
          majorChanges: ["Add review-code operation"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
          diagnosticsPreview: [],
          actions: [
            {
              type: "addNode",
              node: {
                id: "op-1",
                type: "operation",
                position: { x: 100, y: 100 },
                data: {
                  nodeType: "operation",
                  operationId: "review-code",
                  operationName: "Review Code",
                  label: "Review Code",
                  status: "idle",
                },
              },
            },
          ],
        },
      });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await userEvent.type(input, "Add a review step");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockPlanSessionStream).toHaveBeenCalled();
      expect(mockCreateSession).toHaveBeenCalledWith({
        entrypoint: "canvas-agent-panel",
        mode: "edit",
        pipelineId: "pipe-1",
        snapshot: { nodes: [], edges: [] },
      });
    });
  });

  it("keeps an edit proposal needing answers non-applicable while leaving revise and discard enabled", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposalId: "proposal-needs-answer",
        proposal: {
          mode: "edit",
          summary: "Prepare the exam pipeline",
          targetGraphIntent: "Clarify the exam requirements",
          majorChanges: ["Update the output step"],
          assumptions: [],
          openQuestions: ["Which grade level should this target?"],
          readiness: "needs_user_answer",
          diagnosticsPreview: [],
          actions: [
            {
              type: "removeNode",
              nodeId: "node-1",
            },
          ],
        },
      });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    await waitFor(() => expect(mockGetList).toHaveBeenCalled());
    await userEvent.type(
      screen.getByPlaceholderText("workspace.agentBar.composer.placeholder"),
      "Prepare the exam pipeline",
    );
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(mockPlanSessionStream).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.getByTestId("agent-proposal")).toBeInTheDocument();
    });
    expect(screen.getByText(/Which grade level should this target\?/)).toBeInTheDocument();
    expect(screen.getByTestId("agent-proposal-apply")).toBeDisabled();
    expect(screen.getByTestId("agent-proposal-revise")).toBeEnabled();
    expect(screen.getByTestId("agent-proposal-reject")).toBeEnabled();

    await userEvent.click(screen.getByTestId("agent-proposal-apply"));
    expect(mockApproveProposal).not.toHaveBeenCalled();
  });

  it("renders an edit proposal from session fallback when the stream misses proposal_ready", async () => {
    mockPlanSessionStream.mockResolvedValue(undefined);
    mockGetLatestReadyProposal.mockResolvedValueOnce({
      proposalId: "proposal-1",
      proposal: {
        mode: "edit",
        summary: "Fallback edit proposal ready",
        targetGraphIntent: "Change only the display label",
        majorChanges: ["Rename one operation label"],
        assumptions: [],
        openQuestions: [],
        readiness: "ready_for_generation",
        diagnosticsPreview: [],
        actions: [
          {
            type: "replaceNodeData",
            nodeId: "op-1",
            data: {
              nodeType: "operation",
              operationId: "review-code",
              operationName: "Review Code",
              label: "测试审查",
              status: "idle",
            },
          },
        ],
      },
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await userEvent.type(input, "Rename the test node");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockGetLatestReadyProposal).toHaveBeenCalledWith("session-1", "edit", {
        excludeProposalId: null,
      });
      expect(screen.getAllByText("Fallback edit proposal ready").length).toBeGreaterThan(0);
    });
  });

  it("supersedes an edit proposal when discarding it", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposalId: "proposal-1",
        proposal: {
          mode: "edit",
          summary: "Discard this edit proposal",
          targetGraphIntent: "Keep graph unchanged",
          majorChanges: ["No-op"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
          diagnosticsPreview: [],
          actions: [
            {
              type: "removeNode",
              nodeId: "node-1",
            },
          ],
        },
      });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await userEvent.type(
      screen.getByPlaceholderText("workspace.agentBar.composer.placeholder"),
      "Suggest an edit",
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("canvas.agentPanel.discard")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("canvas.agentPanel.discard"));

    await waitFor(() => {
      expect(mockSupersedeProposal).toHaveBeenCalledWith("session-1", "proposal-1");
    });
    await waitFor(() => {
      expect(screen.queryByText("canvas.agentPanel.discard")).not.toBeInTheDocument();
    });
  });

  it("does not apply a session proposal locally when server approval fails", async () => {
    mockApproveProposal.mockRejectedValueOnce(new Error("proposal was superseded"));
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({
        type: "proposal_ready",
        proposalId: "proposal-1",
        proposal: {
          mode: "edit",
          summary: "Remove stale node",
          targetGraphIntent: "Clean up the graph",
          majorChanges: ["Remove stale node"],
          assumptions: [],
          openQuestions: [],
          readiness: "ready_for_generation",
          diagnosticsPreview: [],
          actions: [
            {
              type: "removeNode",
              nodeId: "node-1",
            },
          ],
        },
      });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await userEvent.type(
      screen.getByPlaceholderText("workspace.agentBar.composer.placeholder"),
      "Suggest an edit",
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() => {
      expect(screen.getByText("canvas.agentPanel.apply")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("canvas.agentPanel.apply"));

    await waitFor(() => {
      expect(screen.getByText("proposal was superseded")).toBeInTheDocument();
    });
    expect(mockApproveProposal).toHaveBeenCalledWith("session-1", "proposal-1");
    expect(mockApplyPipelineActions).not.toHaveBeenCalled();
    expect(screen.queryByText("canvas.agentPanel.applied")).not.toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.apply")).toBeInTheDocument();
  });

  it("disables the apply button when a blocking diagnostic is present", async () => {
    const proposal: PipelineActionProposal = {
      summary: "Add a review operation",
      actions: [
        {
          type: "addNode",
          node: {
            id: "op-1",
            type: "operation",
            position: { x: 100, y: 100 },
            data: {
              nodeType: "operation",
              operationId: "review-code",
              operationName: "Review Code",
              label: "Review Code",
              status: "idle",
            },
          },
        },
      ],
    };
    const diagnostics: PipelineActionDiagnostic[] = [
      {
        code: "INVALID_NODE_DATA",
        severity: "error",
        message: "Operation node references rejected drafted operation.",
      },
    ];

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal, diagnostics }),
    });

    const applyButton = screen.getByText("canvas.agentPanel.apply");
    expect(applyButton).toBeDisabled();

    await userEvent.click(applyButton);

    expect(mockApproveProposal).not.toHaveBeenCalled();
    expect(mockApplyPipelineActions).not.toHaveBeenCalled();
  });

  it("renders a follow-up question from session fallback when the stream misses question", async () => {
    mockPlanSessionStream.mockResolvedValue(undefined);
    mockGetLatestAssistantQuestion.mockResolvedValueOnce({
      question: "Which node should I rename?",
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await userEvent.type(input, "Rename a node");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockGetLatestAssistantQuestion).toHaveBeenCalledWith("session-1");
      expect(screen.getByText("Which node should I rename?")).toBeInTheDocument();
    });
  });

  it("applies an existing proposal to the current graph", async () => {
    const proposal: PipelineActionProposal = {
      summary: "Add a review operation",
      actions: [
        {
          type: "addNode",
          node: {
            id: "op-1",
            type: "operation",
            position: { x: 100, y: 100 },
            data: {
              nodeType: "operation",
              operationId: "review-code",
              operationName: "Review Code",
              label: "Review Code",
              status: "idle",
            },
          },
        },
      ],
    };

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal }),
    });

    await userEvent.click(screen.getByText("canvas.agentPanel.apply"));

    expect(mockApplyPipelineActions).toHaveBeenCalled();
    expect(screen.getByText("canvas.agentPanel.applied")).toBeInTheDocument();
  });

  it("starts a generate session when pipelineId is missing", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithoutPipeline });
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText("workspace.agentBar.composer.placeholder");
    await userEvent.type(input, "test");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        entrypoint: "canvas-agent-panel",
        mode: "generate",
        snapshot: { edges: [], nodes: [] },
      });
    });
    expect(input).toHaveValue("");
  });

  it("restores a pending generate proposal for a pipeline-bound home session", async () => {
    globalThis.sessionStorage.setItem("ordine.canvasAgentGenerateSessionId", "session-generate");
    mockGetSessionById.mockResolvedValue({
      id: "session-generate",
      entrypoint: "canvas-agent-panel",
      mode: "generate",
      status: "proposal_ready",
      latestProposalId: "proposal-generate",
      createdPipelineId: null,
      messages: [{ id: "message-1", role: "user", kind: "text", content: "Build a pipeline" }],
      proposals: [
        {
          id: "proposal-generate",
          mode: "generate",
          status: "proposal_ready",
          proposal: {
            mode: "generate",
            purpose: "Restored pipeline",
            inputs: ["Repository folder"],
            outputs: ["Markdown report"],
            majorOperations: ["Review repository"],
            executionFlow: ["Repository folder -> review -> report"],
            assumptions: [],
            openQuestions: [],
            readiness: "ready_for_generation",
          },
        },
      ],
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });

    await waitFor(() => expect(screen.getByTestId("agent-proposal-apply")).toBeInTheDocument());
    expect(mockGetSessionById).toHaveBeenCalledWith("session-generate");
  });
});
