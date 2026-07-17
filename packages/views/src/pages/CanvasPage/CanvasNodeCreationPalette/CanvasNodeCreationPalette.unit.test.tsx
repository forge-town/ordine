import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operation } from "@repo/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { CanvasNodeCreationPalette } from "./CanvasNodeCreationPalette";

const operations = [
  {
    id: "review-code",
    name: "Review Code",
    description: "Find correctness issues",
    config: {},
    acceptedObjectTypes: ["file"],
  },
] as Operation[];

vi.mock("@refinedev/core", () => ({
  useList: () => ({
    result: {
      data: operations,
    },
  }),
}));

const renderQuickAdd = () => {
  const store = createCanvasPageStore();
  store.setState({
    isQuickAddOpen: true,
    screenToFlowPosition: (pos) => ({ x: pos.x / 2, y: pos.y / 2 }),
  });

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasNodeCreationPalette getCreateNodeScreenPosition={() => ({ x: 700, y: 500 })} />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasNodeCreationPalette", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: 800 });
  });

  it("filters object nodes and operations by search text", async () => {
    const user = userEvent.setup();
    renderQuickAdd();

    expect(screen.getAllByText("File").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Review Code\s*OP/ })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Search nodes|搜索节点/), "review");

    expect(screen.queryByText("File")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Code\s*OP/ })).toBeInTheDocument();
  });

  it("creates the selected item centered in the viewport and closes", async () => {
    const user = userEvent.setup();
    const store = renderQuickAdd();

    await user.click(screen.getByRole("button", { name: /Review Code\s*OP/ }));

    const state = store.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0]).toMatchObject({
      type: "operation",
      origin: [0.5, 0.5],
      position: { x: 350, y: 250 },
      data: { label: "Review Code" },
    });
    expect(state.isQuickAddOpen).toBe(false);
  });
});
