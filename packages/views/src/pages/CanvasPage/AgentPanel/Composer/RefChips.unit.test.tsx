import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { RefChips } from "./RefChips";

const ref: WorkspaceCanvasRef = {
  baseId: "review-node",
  id: "review-node",
  kind: "operation",
  label: "Review",
  path: [],
  type: "node",
};

describe("RefChips", () => {
  it("focuses the exact Canvas ref on click", async () => {
    const user = userEvent.setup();
    const onFocusRef = vi.fn();
    render(<RefChips refs={[ref]} onFocusRef={onFocusRef} />);

    await user.click(screen.getByTestId("ref-chip-review-node"));

    expect(onFocusRef).toHaveBeenCalledWith(ref);
  });

  it("removes a ref without also focusing it", async () => {
    const user = userEvent.setup();
    const onFocusRef = vi.fn();
    const onRemoveRef = vi.fn();
    render(<RefChips refs={[ref]} onFocusRef={onFocusRef} onRemoveRef={onRemoveRef} />);

    await user.click(screen.getByTestId("ref-chip-remove-review-node"));

    expect(onRemoveRef).toHaveBeenCalledWith("review-node");
    expect(onFocusRef).not.toHaveBeenCalled();
  });
});
