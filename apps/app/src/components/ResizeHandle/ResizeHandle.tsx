import { useRef, type PointerEvent } from "react";
import { cn } from "@repo/ui/lib/utils";

export type ResizeHandleProps = {
  /** Which panel this handle resizes — affects drag direction. */
  side: "left" | "right";
  /** Show the hairline divider (off for floating panels). */
  line?: boolean;
  onCollapse?: () => void;
  /** Called on drag start with no arguments — capture the panel width here. */
  onDragStart?: () => void;
  /** Cumulative delta since drag start; positive = panel grows. */
  onDelta: (delta: number) => void;
};

/**
 * Draggable column divider (prototype shell.jsx). Double-click collapses.
 * Pointer-capture based so it keeps tracking outside the handle.
 */
export const ResizeHandle = ({
  line = true,
  onCollapse,
  onDelta,
  onDragStart,
  side,
}: ResizeHandleProps) => {
  const startX = useRef(0);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    startX.current = event.clientX;
    onDragStart?.();
    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const rawDelta = moveEvent.clientX - startX.current;
      onDelta(side === "right" ? -rawDelta : rawDelta);
    };
    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <div
      className="group relative z-30 h-full w-1.5 shrink-0 cursor-col-resize"
      data-testid={`resize-handle-${side}`}
      role="separator"
      onDoubleClick={onCollapse}
      onPointerDown={handlePointerDown}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
      {line ? (
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-border-strong" />
      ) : null}
      <div
        className={cn(
          "absolute inset-y-6 left-1/2 w-1 -translate-x-1/2 rounded-full bg-foreground/25 opacity-0 transition-opacity group-hover:opacity-100",
        )}
      />
    </div>
  );
};
