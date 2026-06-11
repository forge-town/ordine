import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CanvasStoreContext,
  createCanvasStore,
  type CanvasStore,
} from "../_store/canvasStore";
import { CanvasToolbar } from "./CanvasToolbar";

const fitViewMock = vi.fn();
const zoomInMock = vi.fn();
const zoomOutMock = vi.fn();

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    fitView: fitViewMock,
    zoomIn: zoomInMock,
    zoomOut: zoomOutMock,
  }),
  useViewport: () => ({ x: 0, y: 0, zoom: 0.78 }),
}));

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("CanvasToolbar", () => {
  beforeEach(() => {
    fitViewMock.mockReset();
    zoomInMock.mockReset();
    zoomOutMock.mockReset();
  });

  it("switches between select and hand tools", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<CanvasToolbar />, { wrapper: makeWrapper(store) });

    expect(store.getState().canvasTool).toBe("select");
    await user.click(screen.getByTestId("canvas-v2-tool-hand"));
    expect(store.getState().canvasTool).toBe("hand");
    await user.click(screen.getByTestId("canvas-v2-tool-select"));
    expect(store.getState().canvasTool).toBe("select");
  });

  it("shows the live zoom percentage and resets via fitView", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<CanvasToolbar />, { wrapper: makeWrapper(store) });

    expect(screen.getByTestId("canvas-v2-zoom-reset").textContent).toBe("78%");
    await user.click(screen.getByTestId("canvas-v2-zoom-reset"));
    expect(fitViewMock).toHaveBeenCalled();
  });

  it("zooms in and out", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<CanvasToolbar />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-zoom-in"));
    await user.click(screen.getByTestId("canvas-v2-zoom-out"));

    expect(zoomInMock).toHaveBeenCalled();
    expect(zoomOutMock).toHaveBeenCalled();
  });
});
