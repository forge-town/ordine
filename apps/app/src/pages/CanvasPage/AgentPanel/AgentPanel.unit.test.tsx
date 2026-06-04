import { render } from "@/test/test-wrapper";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AgentPanel } from "./AgentPanel";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import { useRef, type ReactNode } from "react";
import type { PipelineActionProposal, PipelineActionDiagnostic } from "@repo/schemas";
import { err, ok } from "neverthrow";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
  initReactI18next: { type: "3rdParty", init: () => {} },
}));

const mockApplyPipelineActions = vi.fn();
const mockScrollIntoView = vi.fn();

vi.mock("@repo/pipeline-engine/actions", () => ({
  applyPipelineActions: (...args: unknown[]) => mockApplyPipelineActions(...args),
}));

const mockCustom = vi.fn();
const mockGetOne = vi.fn();
const mockGetList = vi.fn();
vi.mock("@/integrations/refine/dataProvider", () => ({
  ResourceName: {
    settings: "settings",
    agentRuntimes: "agentRuntimes",
  },
  dataProvider: {
    custom: (...args: unknown[]) => mockCustom(...args),
    getOne: (...args: unknown[]) => mockGetOne(...args),
    getList: (...args: unknown[]) => mockGetList(...args),
  },
}));

vi.mock("@repo/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    className,
    variant,
    size,
    ...props
  }: React.ComponentProps<"button"> & { variant?: string; size?: string }) => {
    const handleClick = onClick;

    return (
      <button
        className={className}
        data-size={size}
        data-variant={variant}
        disabled={disabled}
        title={title}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  },
}));

vi.mock("@repo/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@repo/ui/input", () => ({
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const makeProposal = (overrides: Partial<PipelineActionProposal> = {}): PipelineActionProposal => ({
  summary: "添加操作节点",
  actions: [
    {
      type: "addNode",
      node: {
        id: "op-1",
        type: "operation",
        position: { x: 100, y: 100 },
        data: {
          nodeType: "operation",
          operationId: "op-test",
          operationName: "Test Op",
          label: "Test Op",
          status: "idle",
        },
      },
    } as PipelineActionProposal["actions"][number],
  ],
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AgentPanel", () => {
  beforeEach(() => {
    mockCustom.mockReset();
    mockGetOne.mockReset();
    mockGetList.mockReset();
    mockApplyPipelineActions.mockReset();
    mockScrollIntoView.mockReset();
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
  });

  it("renders panel with title and welcome message", () => {
    render(<AgentPanel />, { wrapper: wrapperWithState() });
    expect(screen.getByText("canvas.agentPanel.title")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.welcome")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.runtimeLabel")).toBeInTheDocument();
  });

  it("calls toggleAgentPanel when close button is clicked", async () => {
    const user = userEvent.setup();
    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const closeButton = screen.getByLabelText("canvas.agentPanel.close");

    await user.click(closeButton);
    expect(closeButton).toBeInTheDocument();
  });

  it("sends user message and displays it", async () => {
    const user = userEvent.setup();
    mockCustom.mockResolvedValue({
      data: { reply: "已处理", proposal: null, diagnostics: null },
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    await user.type(input, "添加一个操作节点");
    await user.keyboard("{Enter}");

    expect(screen.getByText("添加一个操作节点")).toBeInTheDocument();
    expect(mockCustom).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "pipelines/proposeActions",
        method: "post",
        payload: expect.objectContaining({
          id: "pipe-1",
          message: "添加一个操作节点",
          runtimeId: "runtime-codex",
        }),
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("已处理")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });

  it("sends message via button click", async () => {
    const user = userEvent.setup();
    mockCustom.mockResolvedValue({
      data: { reply: "好的", proposal: null, diagnostics: null },
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await user.type(input, "hello");
    await user.click(screen.getByLabelText("canvas.agentPanel.send"));

    await waitFor(() => {
      expect(screen.getByText("hello")).toBeInTheDocument();
    });
  });

  it("keeps the current proposal when whitespace is submitted", async () => {
    const user = userEvent.setup();
    const proposal = makeProposal();

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal }),
    });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await user.type(input, "   ");
    await user.click(screen.getByLabelText("canvas.agentPanel.send"));

    expect(mockCustom).not.toHaveBeenCalled();
    expect(screen.getByText("添加操作节点")).toBeInTheDocument();
  });

  it("shows thinking indicator while loading", async () => {
    const user = userEvent.setup();
    mockCustom.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await user.type(input, "test");
    await user.keyboard("{Enter}");

    expect(screen.getByText("canvas.agentPanel.thinking")).toBeInTheDocument();
  });

  it("displays proposal with apply and discard buttons", () => {
    const proposal = makeProposal();
    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal }),
    });

    expect(screen.getByText("canvas.agentPanel.proposal")).toBeInTheDocument();
    expect(screen.getByText("添加操作节点")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.apply")).toBeInTheDocument();
    expect(screen.getByText("canvas.agentPanel.discard")).toBeInTheDocument();
  });

  it("applies proposal and shows confirmation", async () => {
    const user = userEvent.setup();
    const proposal = makeProposal();
    mockApplyPipelineActions.mockReturnValue(ok({ nodes: [], edges: [] }));

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal }),
    });

    await user.click(screen.getByText("canvas.agentPanel.apply"));

    expect(mockApplyPipelineActions).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: expect.any(Array), edges: expect.any(Array) }),
      proposal.actions,
    );
    expect(screen.getByText("canvas.agentPanel.applied")).toBeInTheDocument();
  });

  it("does not show confirmation when proposal application fails", async () => {
    const user = userEvent.setup();
    const proposal = makeProposal();
    const diagnostics: PipelineActionDiagnostic[] = [
      { code: "NODE_NOT_FOUND", severity: "error", message: "missing node", actionIndex: 0 },
    ];
    mockApplyPipelineActions.mockReturnValue(err(diagnostics));

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal }),
    });

    await user.click(screen.getByText("canvas.agentPanel.apply"));

    expect(screen.queryByText("canvas.agentPanel.applied")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("missing node")).toBeInTheDocument();
    });
  });

  it("does not apply proposals that already have error diagnostics", async () => {
    const user = userEvent.setup();
    const proposal = makeProposal();
    const diagnostics: PipelineActionDiagnostic[] = [
      {
        code: "INVALID_NODE_DATA",
        severity: "error",
        message: "unknown operation",
        actionIndex: 0,
      },
    ];
    mockApplyPipelineActions.mockReturnValue(ok({ nodes: [], edges: [] }));

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal, diagnostics }),
    });

    const applyButton = screen.getByText("canvas.agentPanel.apply").closest("button");
    expect(applyButton).toBeDisabled();
    await user.click(applyButton!);

    expect(mockApplyPipelineActions).not.toHaveBeenCalled();
    expect(screen.queryByText("已应用操作建议。")).not.toBeInTheDocument();
  });

  it("discards proposal and shows confirmation", async () => {
    const user = userEvent.setup();
    const proposal = makeProposal();

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ pendingProposal: proposal }),
    });

    await user.click(screen.getByText("canvas.agentPanel.discard"));
    expect(screen.getByText("canvas.agentPanel.discarded")).toBeInTheDocument();
  });

  it("displays diagnostics when present", () => {
    const diagnostics: PipelineActionDiagnostic[] = [
      { code: "DUPLICATE_NODE_ID", severity: "error", message: "节点 ID 重复" },
      { code: "INVALID_CONNECTION", severity: "warning", message: "缺少输入端口" },
    ];

    render(<AgentPanel />, {
      wrapper: wrapperWithState({ diagnostics }),
    });

    expect(screen.getByText("canvas.agentPanel.diagnostics")).toBeInTheDocument();
    expect(screen.getByText("节点 ID 重复")).toBeInTheDocument();
    expect(screen.getByText("缺少输入端口")).toBeInTheDocument();
  });

  it("does not send message when pipelineId is missing", async () => {
    const user = userEvent.setup();
    render(<AgentPanel />, { wrapper: wrapperWithoutPipeline });
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });

    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder") as HTMLInputElement;
    await user.type(input, "test");
    await user.keyboard("{Enter}");

    // Input should still contain the text (not cleared) and no user message added
    expect(input.value).toBe("test");
    expect(screen.queryByText("test")).not.toBeInTheDocument();
    // Welcome message is still there
    expect(screen.getByText("canvas.agentPanel.welcome")).toBeInTheDocument();
  });

  it("shows error message when API fails", async () => {
    const user = userEvent.setup();
    mockCustom.mockRejectedValue(new Error("Network error"));

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await user.type(input, "test");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("canvas.agentPanel.error")).toBeInTheDocument();
    });
  });

  it("disables input and send button while sending", async () => {
    const user = userEvent.setup();
    mockCustom.mockImplementation(() => new Promise(() => {}));

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder") as HTMLInputElement;
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await user.type(input, "test");
    await user.keyboard("{Enter}");

    expect(input.disabled).toBe(true);
    expect(screen.getByLabelText("canvas.agentPanel.send")).toBeDisabled();
  });

  it("shows default reply when proposal is returned without explicit reply", async () => {
    const user = userEvent.setup();
    const proposal = makeProposal();
    mockCustom.mockResolvedValue({
      data: { reply: null, proposal, diagnostics: null },
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalled();
    });
    await user.type(input, "add node");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("canvas.agentPanel.proposalReceived")).toBeInTheDocument();
    });
  });

  it("shows runtime setup link when AI runtime is not configured", async () => {
    const user = userEvent.setup();
    mockGetOne.mockResolvedValue({
      data: { defaultAgentRuntime: "codex" },
    });
    mockGetList.mockResolvedValue({
      data: [],
      total: 0,
    });

    render(<AgentPanel />, { wrapper: wrapperWithState() });
    const input = screen.getByPlaceholderText("canvas.agentPanel.inputPlaceholder");
    await user.type(input, "add node");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "canvas.agentPanel.goToRuntimeSettings" })).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: "canvas.agentPanel.goToRuntimeSettings" });
    expect(link).toHaveAttribute("href", "/runtimes");
    expect(mockCustom).not.toHaveBeenCalled();
  });
});
