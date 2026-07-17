import { render } from "@/test/test-wrapper";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { NodeContextMenu } from "./NodeContextMenu";

vi.mock("@/routes/canvas", () => ({
  Route: {
    useLoaderData: () => ({
      pipeline: null,
      operations: [],
      bestPractices: [],
    }),
  },
}));

describe("NodeContextMenu", () => {
  it("renders without crashing", () => {
    const store = createCanvasPageStore();
    const { container } = render(
      <CanvasPageStoreContext.Provider value={store}>
        <NodeContextMenu />
      </CanvasPageStoreContext.Provider>,
    );
    // Returns null when nodeContextMenu is null in store – that's expected
    expect(container).toBeTruthy();
  });
});
