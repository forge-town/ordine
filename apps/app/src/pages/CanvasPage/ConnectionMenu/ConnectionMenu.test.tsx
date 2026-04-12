import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store/harnessCanvasStore";
import { ConnectionMenu } from "./ConnectionMenu";

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

describe("ConnectionMenu", () => {
  it("renders without crashing", () => {
    const store = createHarnessCanvasStore();
    const { container } = render(
      <HarnessCanvasStoreContext.Provider value={store}>
        <ConnectionMenu />
      </HarnessCanvasStoreContext.Provider>
    );
    // Returns null when no connectStart in store – that's expected
    expect(container).toBeTruthy();
  });
});
