import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import { CanvasToolbar } from "./CanvasToolbar";

const flowMocks = vi.hoisted(() => ({ fitView: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn() }));

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => flowMocks,
  useViewport: () => ({ x: 0, y: 0, zoom: 0.78 }),
}));

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: React.PropsWithChildren) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("CanvasToolbar", () => {
  beforeEach(() => {
    flowMocks.fitView.mockReset();
    flowMocks.zoomIn.mockReset();
    flowMocks.zoomOut.mockReset();
  });

  it("switches tools and controls the viewport", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<CanvasToolbar />, { wrapper: makeWrapper(store) });

    const handTool = screen.getByTestId("canvas-v2-tool-hand");
    const selectTool = screen.getByTestId("canvas-v2-tool-select");

    expect(store.getState().canvasTool).toBe("hand");
    expect(handTool).toHaveAttribute("aria-pressed", "true");
    expect(handTool).toHaveClass("bg-foreground", "text-background");
    expect(selectTool).toHaveAttribute("aria-pressed", "false");

    await user.click(selectTool);
    expect(store.getState().canvasTool).toBe("select");
    expect(selectTool).toHaveAttribute("aria-pressed", "true");
    expect(handTool).toHaveAttribute("aria-pressed", "false");

    expect(screen.getByTestId("canvas-v2-zoom-reset")).toHaveTextContent("78%");
    await user.click(screen.getByTestId("canvas-v2-zoom-in"));
    await user.click(screen.getByTestId("canvas-v2-zoom-out"));
    await user.click(screen.getByTestId("canvas-v2-zoom-reset"));

    expect(flowMocks.zoomIn).toHaveBeenCalled();
    expect(flowMocks.zoomOut).toHaveBeenCalled();
    expect(flowMocks.fitView).toHaveBeenCalled();
  });
});
