import { render } from "@/test/test-wrapper";
import { describe, expect, it } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { ConnectionMenu } from "./ConnectionMenu";

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
