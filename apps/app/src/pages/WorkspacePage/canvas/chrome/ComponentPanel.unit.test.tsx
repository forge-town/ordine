import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Operation } from "@repo/schemas";
import {
  CanvasStoreContext,
  createCanvasStore,
  type CanvasStore,
} from "../_store/canvasStore";
import { ComponentPanel } from "./ComponentPanel";

const operation: Operation = {
  id: "op-1",
  name: "Parse PDF",
  description: "",
  config: { inputs: [], outputs: [] },
  acceptedObjectTypes: ["file"],
  meta: { createdAt: new Date(), updatedAt: new Date() },
};

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
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

describe("ComponentPanel", () => {
  it("is collapsed by default and opens from the pill", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<ComponentPanel />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-components-panel")).not.toBeInTheDocument();
    await user.click(screen.getByTestId("canvas-v2-components-toggle"));
    expect(screen.getByTestId("canvas-v2-components-panel")).toBeInTheDocument();
  });

  it("adds a built-in object node on click", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    store.getState().setCompPanelOpen(true);
    render(<ComponentPanel />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-component-object-folder"));

    expect(store.getState().nodes).toHaveLength(1);
    expect(store.getState().nodes[0]?.type).toBe("folder");
  });

  it("adds an operation node from the library", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    store.getState().setCompPanelOpen(true);
    render(<ComponentPanel />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-component-operation-op-1"));

    const node = store.getState().nodes[0];
    expect(node?.type).toBe("operation");
    expect(node?.data).toMatchObject({ operationId: "op-1", operationName: "Parse PDF" });
  });

  it("adds a compound shell with the requested kind", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    store.getState().setCompPanelOpen(true);
    render(<ComponentPanel />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-component-compound-verify"));

    const node = store.getState().nodes[0];
    expect(node?.type).toBe("compound");
    expect(node?.data).toMatchObject({ compoundKind: "verify" });
  });

  it("hides inside a compound drill", () => {
    const store = createCanvasStore();
    store.getState().pushDrillStack("compound-1");
    render(<ComponentPanel />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-components-toggle")).not.toBeInTheDocument();
  });
});
