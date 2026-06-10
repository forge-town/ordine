import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore, type CanvasPageStore } from "../_store";
import type { PipelineEdge } from "../_store/canvasSlice";
import { EdgeInspector } from "./EdgeInspector";

const updateMock = vi.fn();

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({ mutate: updateMock }),
}));

const edge = {
  id: "edge-a",
  source: "node-a",
  target: "node-b",
  type: "semantic",
  data: {
    label: "files",
    dataContract: {
      mappings: [{ fromField: "files[]", toInput: "input.files", type: "array", enabled: true }],
    },
  },
} as PipelineEdge;

const makeWrapper =
  (store: CanvasPageStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasPageStoreContext.Provider value={store}>{children}</CanvasPageStoreContext.Provider>
  );

describe("EdgeInspector", () => {
  it("toggles a data contract mapping and persists pipeline edges", () => {
    updateMock.mockReset();
    const store = createCanvasPageStore([], [edge], "pipe-1", "Pipeline");
    store.setState({ inspectEdgeId: edge.id });

    render(<EdgeInspector />, { wrapper: makeWrapper(store) });

    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    const updatedEdge = store.getState().edges[0];
    expect(updatedEdge?.data?.dataContract?.mappings[0]?.enabled).toBe(false);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "pipelines",
        id: "pipe-1",
        values: expect.objectContaining({
          edges: [
            expect.objectContaining({
              data: expect.objectContaining({
                dataContract: expect.objectContaining({
                  mappings: [expect.objectContaining({ enabled: false })],
                }),
              }),
            }),
          ],
        }),
      }),
    );
  });

  it("closes the inspector", () => {
    const store = createCanvasPageStore([], [edge], "pipe-1", "Pipeline");
    store.setState({ inspectEdgeId: edge.id });

    render(<EdgeInspector />, { wrapper: makeWrapper(store) });
    fireEvent.click(screen.getByRole("button", { name: "Close Edge Inspector" }));

    expect(store.getState().inspectEdgeId).toBeNull();
  });
});
