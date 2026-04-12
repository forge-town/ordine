import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store/harnessCanvasStore";
import { NodeContextMenu } from "./NodeContextMenu";

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

describe("NodeContextMenu", () => {
  it("renders without crashing", () => {
    const store = createHarnessCanvasStore();
    const { container } = render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <NodeContextMenu />
      </HarnessCanvasStoreContext.Provider>
    );
    // Returns null when nodeContextMenu is null in store – that's expected
    expect(container).toBeTruthy();
  });
});
