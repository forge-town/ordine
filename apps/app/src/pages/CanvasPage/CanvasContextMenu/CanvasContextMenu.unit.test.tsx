import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store/harnessCanvasStore";
import { CanvasContextMenu } from "./CanvasContextMenu";

vi.mock("@/routes/canvas", () => ({
  Route: {
    useLoaderData: () => ({
      pipeline: null,
      operations: [],
      recipes: [],
      bestPractices: [],
    }),
  },
}));

const createTestStore = () => {
  const store = createHarnessCanvasStore();
  store.setState({
    contextMenu: { screenX: 200, screenY: 200, flowX: 100, flowY: 100 },
  });

  return store;
};

describe("CanvasContextMenu", () => {
  it("renders without crashing", () => {
    const store = createTestStore();
    render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <CanvasContextMenu />
      </HarnessCanvasStoreContext.Provider>
    );
    expect(screen.getByText("新建节点")).toBeTruthy();
  });
});
