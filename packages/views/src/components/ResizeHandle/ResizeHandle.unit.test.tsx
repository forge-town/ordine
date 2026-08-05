import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ResizeHandle } from "./ResizeHandle";

describe("ResizeHandle", () => {
  it("reports cumulative pointer delta with the correct direction", () => {
    const handleDelta = vi.fn();
    const handleDragStart = vi.fn();
    render(<ResizeHandle side="right" onDelta={handleDelta} onDragStart={handleDragStart} />);
    const handle = screen.getByRole("separator", { name: "Resize panel" });

    fireEvent.pointerDown(handle, { clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 124, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 124, pointerId: 1 });

    expect(handleDragStart).toHaveBeenCalledTimes(1);
    expect(handleDelta).toHaveBeenCalledWith(-24);
    expect(document.body.style.cursor).toBe("");
  });

  it("supports keyboard resizing and collapse", () => {
    const handleCollapse = vi.fn();
    const handleDelta = vi.fn();
    render(
      <ResizeHandle
        keyboardStep={12}
        side="left"
        onCollapse={handleCollapse}
        onDelta={handleDelta}
      />,
    );
    const handle = screen.getByRole("separator", { name: "Resize panel" });

    fireEvent.keyDown(handle, { key: "ArrowRight" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    fireEvent.keyDown(handle, { key: "Enter" });

    expect(handleDelta).toHaveBeenNthCalledWith(1, 12);
    expect(handleDelta).toHaveBeenNthCalledWith(2, -12);
    expect(handleCollapse).toHaveBeenCalledTimes(1);
  });
});
