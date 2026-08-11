import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/lib/i18n";
import { describe, expect, it } from "vitest";
import { CanvasStoreContext, createCanvasStore, type CanvasStore } from "./_store/canvasStore";
import type { CanvasNode } from "./_store/canvasTypes";
import { CanvasEmptyState } from "./CanvasEmptyState";

const makeWrapper =
  (store: CanvasStore) =>
  ({ children }: { children: React.ReactNode }) => (
    <CanvasStoreContext.Provider value={store}>{children}</CanvasStoreContext.Provider>
  );

const makeNode = (): CanvasNode => ({
  data: {
    label: "Prompt",
    nodeType: "prompt",
    prompt: "",
  },
  id: "node-a",
  position: { x: 0, y: 0 },
  type: "prompt",
});

describe("CanvasEmptyState", () => {
  it("seeds a starter node in development mode", async () => {
    const user = userEvent.setup();
    const store = createCanvasStore();
    render(<CanvasEmptyState />, { wrapper: makeWrapper(store) });

    await user.click(screen.getByTestId("canvas-v2-empty-seed"));

    expect(store.getState().nodes).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          label: i18n.t("workspace.canvas.empty.seedLabel"),
        }),
        type: "prompt",
      }),
    ]);
  });

  it("allows canvas drops through the empty-state copy while keeping the seed action clickable", () => {
    const store = createCanvasStore();
    render(<CanvasEmptyState />, { wrapper: makeWrapper(store) });

    expect(screen.getByRole("heading").parentElement).not.toHaveClass("pointer-events-auto");
    expect(screen.getByTestId("canvas-v2-empty-seed")).toHaveClass("pointer-events-auto");
  });

  it("hides once the graph has nodes", () => {
    const store = createCanvasStore({ nodes: [makeNode()] });
    render(<CanvasEmptyState />, { wrapper: makeWrapper(store) });

    expect(screen.queryByTestId("canvas-v2-empty-state")).not.toBeInTheDocument();
  });
});
