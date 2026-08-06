import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Operation } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "../_store/canvasStore";
import { CANVAS_COMPONENT_DRAG_MIME } from "../utils/canvasComponentDragPayload";
import { ComponentPanel } from "./ComponentPanel";

const operation = {
  acceptedObjectTypes: ["file", "folder", "github-project", "prompt"],
  config: { inputs: [], outputs: [] },
  description: "Parse a PDF",
  id: "op-1",
  name: "Parse PDF",
} satisfies Operation;

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: [operation], total: 1 } }),
}));

vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
  }),
}));

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: React.PropsWithChildren) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("ComponentPanel", () => {
  it("opens, adds nodes, and writes the drag payload", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<ComponentPanel />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-components-toggle"));
    await user.click(screen.getByTestId("canvas-v2-component-object-folder"));
    expect(store.getState().nodes[0]?.type).toBe("folder");
    expect(store.getState().historyPast).toHaveLength(1);

    const setData = vi.fn();
    const dragStart = createEvent.dragStart(
      screen.getByTestId("canvas-v2-component-operation-op-1"),
    );
    Object.defineProperty(dragStart, "dataTransfer", {
      value: { effectAllowed: "none", setData, types: [] },
    });
    fireEvent(screen.getByTestId("canvas-v2-component-operation-op-1"), dragStart);
    expect(setData).toHaveBeenCalledWith(CANVAS_COMPONENT_DRAG_MIME, expect.any(String));
  });
});
