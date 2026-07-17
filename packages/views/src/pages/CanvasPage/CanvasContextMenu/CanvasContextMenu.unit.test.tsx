import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { CanvasContextMenu } from "./CanvasContextMenu";

vi.mock("@/routes/canvas", () => ({
  Route: {
    useLoaderData: () => ({
      pipeline: null,
      operations: [],
      bestPractices: [],
    }),
  },
}));

const createTestStore = () => {
  const store = createCanvasPageStore();
  store.setState({
    contextMenu: { screenX: 200, screenY: 200, flowX: 100, flowY: 100 },
  });

  return store;
};

describe("CanvasContextMenu", () => {
  it("renders without crashing", () => {
    const store = createTestStore();
    render(
      <CanvasPageStoreContext.Provider value={store}>
        <CanvasContextMenu />
      </CanvasPageStoreContext.Provider>,
    );
    expect(screen.getByText("New Node")).toBeTruthy();
  });
});
