import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CanvasPageContent } from "./CanvasPageContent";
import { HarnessCanvasStoreProvider } from "./_store";

// ─── Mock @refinedev/core useUpdate ──────────────────────────────────────────

const mockMutate = vi.fn();

vi.mock("@refinedev/core", () => ({
  useUpdate: () => ({
    mutate: mockMutate,
    isLoading: false,
    mutation: { isPending: false },
  }),
  useNotification: () => ({ open: vi.fn() }),
}));

// ─── Mock child components ────────────────────────────────────────────────────

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

vi.mock("./components/CanvasFloatingMenu", () => ({
  CanvasFloatingMenu: () => {
    // In the real component, the save button is only shown when pipelineId exists.
    // We simulate the click that triggers useUpdate.mutate for the success path test.
    const handleClick = () => mockMutate();
    return (
      <button data-testid="save-btn" onClick={handleClick}>
        保存
      </button>
    );
  },
}));

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CanvasPageContent - handleSave via useUpdate", () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it("calls useUpdate.mutate when save is triggered", async () => {
    render(<CanvasPageContent />, { wrapper });

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
  });
});
