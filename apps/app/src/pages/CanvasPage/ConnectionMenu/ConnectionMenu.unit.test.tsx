import { render } from "@/test/test-wrapper";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { ConnectionMenu } from "./ConnectionMenu";

vi.mock("@/routes/canvas", () => ({
  Route: {
    useLoaderData: () => ({
      pipeline: null,
      operations: [],
      bestPractices: [],
    }),
  },
}));

describe("ConnectionMenu", () => {
  it("renders without crashing", () => {
    const store = createCanvasPageStore();
    const { container } = render(
      <CanvasPageStoreContext.Provider value={store}>
        <ConnectionMenu />
      </CanvasPageStoreContext.Provider>,
    );
    // Returns null when no connectStart in store – that's expected
    expect(container).toBeTruthy();
  });
});
