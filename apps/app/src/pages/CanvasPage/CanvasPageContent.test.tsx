import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CanvasPageContent } from "./CanvasPageContent";
import { HarnessCanvasStoreProvider } from "./_store";
import type * as Store from "./_store";
import type * as Zustand from "zustand";

// ─── Mock @refinedev/core useUpdate ──────────────────────────────────────────

const mockMutate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({
    mutate: mockMutate,
    isLoading: false,
  }),
  useNotification: () => ({ open: vi.fn() }),
}));

// ─── Mock child components ────────────────────────────────────────────────────

vi.mock("./_store", async (importOriginal) => {
  const actual = await importOriginal<typeof Store>();
  return actual;
});

vi.mock("./components/CanvasFlow", () => ({
  CanvasFlow: () => <div data-testid="canvas-flow" />,
}));

vi.mock("./components/CanvasToolbar", () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar" />,
}));

vi.mock("./components/CanvasContextMenu", () => ({
  CanvasContextMenu: () => null,
}));

vi.mock("./components/ConnectionMenu", () => ({
  ConnectionMenu: () => null,
}));

vi.mock("./components/NodeContextMenu", () => ({
  NodeContextMenu: () => null,
}));

vi.mock("./components/CanvasFloatingMenu", async () => {
  const actualStore = await vi.importActual<typeof Store>("./_store");
  const actualZustand = await vi.importActual<typeof Zustand>("zustand");

  const FloatingMenuMock = () => {
    const store = actualStore.useHarnessCanvasStore();
    const saveCanvas = actualZustand.useStore(store, (s) => s.saveCanvas);
    return (
      <button data-testid="save-btn" onClick={saveCanvas}>
        保存
      </button>
    );
  };

  return { CanvasFloatingMenu: FloatingMenuMock };
});

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makePipeline = () => ({
  id: "pipe-test",
  name: "Test Pipeline",
  nodes: [],
  edges: [],
});

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={makePipeline()}>
    {children}
  </HarnessCanvasStoreProvider>
);

const nullWrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    {children}
  </HarnessCanvasStoreProvider>
);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CanvasPageContent - handleSave via useUpdate", () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it("calls useUpdate.mutate with resource=pipelines and correct variables when save is triggered", async () => {
    render(<CanvasPageContent />, { wrapper });

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });

    const callArg = mockMutate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg?.["resource"]).toBe("pipelines");
    expect(callArg?.["id"]).toBe("pipe-test");
    expect(callArg?.["values"]).toMatchObject({
      nodes: expect.any(Array) as unknown,
      edges: expect.any(Array) as unknown,
    });
  });

  it("does NOT call useUpdate.mutate when pipelineId is null", () => {
    render(<CanvasPageContent />, { wrapper: nullWrapper });

    const saveBtn = screen.queryByTestId("save-btn");
    // When no pipelineId, save button should not be rendered (onSave is undefined → button absent or no-op)
    if (saveBtn) {
      fireEvent.click(saveBtn);
    }

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
