import { render } from "@/test/test-wrapper";
import i18n from "@/lib/i18n";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperationNodeData } from "@repo/schemas";
import { createHarnessCanvasStore, HarnessCanvasStoreContext, type PipelineNode } from "../_store";
import { OperationNode } from "./OperationNode";

vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useNodeId: () => "operation-node",
  useUpdateNodeInternals: () => () => undefined,
}));

vi.mock("@refinedev/core", () => ({
  useList: ({ resource }: { resource: string }) => {
    if (resource === "agents") {
      return {
        result: {
          data: [{ id: "agent-claude", name: "Claude" }],
        },
      };
    }

    return {
      result: {
        data: [
          {
            id: "review-code",
            name: "Review Code",
            description: "Review code with an agent",
            acceptedObjectTypes: ["file", "project"],
          },
        ],
      },
    };
  },
}));

const nodeId = "operation-node";

const baseData: OperationNodeData = {
  label: "Review Code",
  nodeType: "operation",
  operationId: "review-code",
  operationName: "Review Code",
  status: "idle",
  config: {},
  agentRuntime: "codex",
  loopEnabled: true,
  maxLoopCount: 3,
  loopConditionPrompt: "No blocking review findings remain.",
};

const renderOperationNode = (
  data: OperationNodeData = baseData,
  parentHandlers: {
    handleParentClick?: () => void;
    handleParentMouseDown?: () => void;
  } = {}
) => {
  const node = {
    id: nodeId,
    type: "operation",
    position: { x: 0, y: 0 },
    data,
  } as PipelineNode;
  const store = createHarnessCanvasStore([node]);

  const wrapper = ({ children }: React.PropsWithChildren) => (
    <HarnessCanvasStoreContext.Provider value={store}>
      <div
        onClick={parentHandlers.handleParentClick}
        onMouseDown={parentHandlers.handleParentMouseDown}
      >
        {children}
      </div>
    </HarnessCanvasStoreContext.Provider>
  );

  render(<OperationNode data={data} id={nodeId} />, { wrapper });

  return store;
};

describe("OperationNode", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh");
  });

  it("renders localized embedded-control labels and accessible names", () => {
    renderOperationNode();

    expect(screen.getByText("Agent")).toBeInTheDocument();
    expect(screen.getByText("最大轮次")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Agent" })).toHaveClass(
      "h-8",
      "w-full",
      "nodrag",
      "nopan"
    );
    expect(screen.getByRole("spinbutton", { name: "最大循环次数" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "循环验收条件" })).toBeInTheDocument();
  });

  it("updates runtime selection without bubbling canvas interactions", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    const parentMouseDown = vi.fn();
    const store = renderOperationNode(baseData, {
      handleParentClick: parentClick,
      handleParentMouseDown: parentMouseDown,
    });

    await user.click(screen.getByRole("combobox", { name: "Agent" }));

    expect(parentClick).not.toHaveBeenCalled();
    expect(parentMouseDown).not.toHaveBeenCalled();

    await user.click(await screen.findByRole("option", { name: "Claude" }));

    await waitFor(() => {
      expect(store.getState().nodes[0]?.data).toMatchObject({
        agentId: "agent-claude",
      });
    });
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("updates loop settings without bubbling canvas interactions", async () => {
    const user = userEvent.setup();
    const parentClick = vi.fn();
    const parentMouseDown = vi.fn();
    const store = renderOperationNode(baseData, {
      handleParentClick: parentClick,
      handleParentMouseDown: parentMouseDown,
    });

    await user.click(screen.getByRole("button", { name: "循环已开启" }));

    await waitFor(() => {
      expect(store.getState().nodes[0]?.data).toMatchObject({
        loopEnabled: false,
      });
    });
    expect(parentClick).not.toHaveBeenCalled();
    expect(parentMouseDown).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("spinbutton", { name: "最大循环次数" }), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "循环验收条件" }), {
      target: { value: "Ship it" },
    });

    await waitFor(() => {
      expect(store.getState().nodes[0]?.data).toMatchObject({
        maxLoopCount: 5,
        loopConditionPrompt: "Ship it",
      });
    });
    expect(parentClick).not.toHaveBeenCalled();
  });
});
