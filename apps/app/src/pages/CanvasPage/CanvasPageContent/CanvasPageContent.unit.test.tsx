import { render } from "@/test/test-wrapper";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CanvasPageContent } from "./CanvasPageContent";

// ─── Mock @refinedev/core useUpdate ──────────────────────────────────────────

const mockMutate = vi.fn();

// ─── Mock CanvasInner (the only direct child) ────────────────────────────────

vi.mock("../CanvasInner", () => ({
  CanvasInner: () => {
    const handleClick = () => mockMutate();

    return (
      <div data-testid="canvas-inner">
        <div data-testid="canvas-flow" />
        <div data-testid="canvas-toolbar" />
        <button data-testid="save-btn" onClick={handleClick}>
          保存
        </button>
      </div>
    );
  },
}));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CanvasPageContent - handleSave via useUpdate", () => {
  beforeEach(() => {
    mockMutate.mockClear();
  });

  it("calls useUpdate.mutate when save is triggered", async () => {
    render(<CanvasPageContent />);

    const saveBtn = screen.getByTestId("save-btn");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledTimes(1);
    });
  });
});
