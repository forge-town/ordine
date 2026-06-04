import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AgentPanel } from "./AgentPanel";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import { useRef, type ReactNode } from "react";
import type { PipelineActionProposal, PipelineActionDiagnostic } from "@repo/schemas";
import { ok } from "neverthrow";

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
const mockAppendMessage = vi.fn();
const mockUploadAttachment = vi.fn();
const mockPlanSessionStream = vi.fn();
const mockApproveProposal = vi.fn();

vi.mock("@repo/pipeline-engine/actions", () => ({
  applyPipelineActions: (...args: unknown[]) => mockApplyPipelineActions(...args),
}));

vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: {
    settings: "settings",
    agentRuntimes: "agentRuntimes",
  },
  dataProvider: {
    getOne: (...args: unknown[]) => mockGetOne(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
  },
}));

vi.mock("@/lib/pipelineAgentSessionsClient", () => ({
  pipelineAgentSessionsClient: {
    appendMessage: (...args: unknown[]) => mockAppendMessage(...args),
    approveProposal: (...args: unknown[]) => mockApproveProposal(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    planSessionStream: (...args: unknown[]) => mockPlanSessionStream(...args),
    uploadAttachment: (...args: unknown[]) => mockUploadAttachment(...args),
  },
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

vi.mock("@repo/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
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

describe("AgentPanel", () => {
  beforeEach(() => {
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
    mockApplyPipelineActions.mockReturnValue(ok({ nodes: [], edges: [] }));
  });

  it("renders panel with title and welcome message", () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });
    expect(screen.getByText("canvas.agentPanel.title")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.welcome")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.runtimeLabel")).toBeInTheDocument();
  });

  it("creates an edit session, sends a message, and displays a streamed follow-up question", async () => {
    mockPlanSessionStream.mockImplementation(async (_sessionId, { onEvent }) => {
      onEvent({ type: "phase", phase: "planning" });
      onEvent({ type: "question", question: "Which output node should receive the report?" });
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
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
  });

  it("uploads a file into the edit session context", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });

    const file = new File(["hello"], "brief.txt", { type: "text/plain" });
    const input = screen.getByLabelText("canvas.agentPanel.upload") as HTMLInputElement;
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalled();
    });
    expect(mockUploadAttachment).toHaveBeenCalledWith("session-1", file);
    await waitFor(() => {
      expect(screen.getByText("brief.txt")).toBeInTheDocument();
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
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
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

  it("does not send when pipelineId is missing", async () => {
    render(<AgentPanel />, { wrapper: wrapperWithoutPipeline });
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await userEvent.type(input, "test");
    await userEvent.keyboard("{Enter}");

    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(screen.queryByText("test")).not.toBeInTheDocument();
  });
});
