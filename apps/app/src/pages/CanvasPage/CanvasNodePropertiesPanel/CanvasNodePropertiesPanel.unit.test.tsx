import { render } from "@/test/test-wrapper";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { CanvasNodePropertiesPanel } from "./CanvasNodePropertiesPanel";

const fileNode = {
  id: "file-1",
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "",
  },
} as PipelineNode;

const operationNode = {
  id: "operation-1",
  type: "operation",
  position: { x: 0, y: 0 },
  data: {
    label: "Review Code",
    nodeType: "operation",
    operationId: "review-code",
    operationName: "Review Code",
    status: "idle",
    config: {},
    loopEnabled: true,
    maxLoopCount: 3,
    loopConditionPrompt: "",
  },
} as PipelineNode;

const renderPanel = (node: PipelineNode = fileNode) => {
  const store = createCanvasPageStore([node]);
  store.setState({ selectedNodeId: node.id, sidebarPanel: "properties" });

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasNodePropertiesPanel />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasNodePropertiesPanel", () => {
  it("edits selected file node data from the left panel", async () => {
    const user = userEvent.setup();
    const store = renderPanel();

    const pathInput = screen.getByRole("textbox", { name: /File path/i });

    await user.clear(pathInput);
    await user.type(pathInput, "src/app.tsx");

    expect(store.getState().nodes[0]?.data).toEqual(
      expect.objectContaining({
        filePath: "src/app.tsx",
      }),
    );
  });

  it("returns to the component panel from properties", async () => {
    const user = userEvent.setup();
    const store = renderPanel();

    await user.click(screen.getByRole("button", { name: /Back to components/i }));

    expect(store.getState().sidebarPanel).toBe("components");
    expect(store.getState().selectedNodeId).toBeNull();
  });

  it("stores operation max loop count edits as a number", () => {
    const store = renderPanel(operationNode);

    fireEvent.change(screen.getByRole("spinbutton", { name: /Max loop count/i }), {
      target: { value: "8" },
    });

    const data = store.getState().nodes[0]?.data as { maxLoopCount?: unknown };

    expect(data.maxLoopCount).toBe(8);
    expect(typeof data.maxLoopCount).toBe("number");
  });

  it("uses number input semantics for max loop count edits", () => {
    const store = renderPanel(operationNode);
    const input = screen.getByRole("spinbutton", { name: /Max loop count/i });
    const readMaxLoopCount = () =>
      (store.getState().nodes[0]?.data as { maxLoopCount?: unknown } | undefined)?.maxLoopCount;

    fireEvent.change(input, { target: { value: "1e2" } });
    expect(readMaxLoopCount()).toBe(20);

    fireEvent.change(input, { target: { value: "7.5" } });
    expect(readMaxLoopCount()).toBe(20);
  });
});
