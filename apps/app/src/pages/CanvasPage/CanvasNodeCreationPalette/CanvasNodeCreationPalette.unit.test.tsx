import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operation, Recipe } from "@repo/schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store/harnessCanvasStore";
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

const recipes = [
  {
    id: "strict-review",
    name: "Strict Review",
    description: "Review with stronger checks",
    operationId: "review-code",
    bestPracticeId: "bp-strict",
  },
] as Recipe[];

vi.mock("@refinedev/core", () => ({
  useList: ({ resource }: { resource: string }) => ({
    result: {
      data: resource === "operations" ? operations : recipes,
    },
  }),
}));

const renderQuickAdd = () => {
  const store = createHarnessCanvasStore();
  store.setState({
    isQuickAddOpen: true,
    screenToFlowPosition: (pos) => ({ x: pos.x / 2, y: pos.y / 2 }),
  });

  render(
    <HarnessCanvasStoreContext.Provider value={store}>
      <CanvasNodeCreationPalette getCreateNodeScreenPosition={() => ({ x: 700, y: 500 })} />
    </HarnessCanvasStoreContext.Provider>
  );

  return store;
};

describe("CanvasNodeCreationPalette", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "innerWidth", { configurable: true, value: 1000 });
    Object.defineProperty(globalThis, "innerHeight", { configurable: true, value: 800 });
  });

  it("filters object nodes, operations, and recipes by search text", async () => {
    const user = userEvent.setup();
    renderQuickAdd();

    expect(screen.getByText("代码文件")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Code\s*OP/ })).toBeInTheDocument();
    expect(screen.getByText("Strict Review")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Search nodes|搜索节点/), "strict");

    expect(screen.queryByText("代码文件")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Review Code\s*OP/ })).not.toBeInTheDocument();
    expect(screen.getByText("Strict Review")).toBeInTheDocument();
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
