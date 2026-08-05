import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@repo/ui/lib/utils";

export type ResizeHandleProps = {
  className?: string;
  keyboardStep?: number;
  line?: boolean;
  onCollapse?: () => void;
  onDelta: (delta: number) => void;
  onDragStart?: () => void;
  side: "left" | "right";
};

export const ResizeHandle = ({
  className,
  keyboardStep = 16,
  line = true,
  onCollapse,
  onDelta,
  onDragStart,
  side,
}: ResizeHandleProps) => {
  const startX = useRef(0);
  const dragging = useRef(false);

  const handleDragEnd = () => {
    dragging.current = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  };

  useEffect(() => handleDragEnd, []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    startX.current = event.clientX;
    dragging.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    onDragStart?.();
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    const rawDelta = event.clientX - startX.current;
    onDelta(side === "right" ? -rawDelta : rawDelta);
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;

    event.currentTarget.releasePointerCapture?.(event.pointerId);
    handleDragEnd();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" && onCollapse) {
      event.preventDefault();
      onCollapse();

      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

    event.preventDefault();
    const rawDelta = event.key === "ArrowRight" ? keyboardStep : -keyboardStep;
    onDragStart?.();
    onDelta(side === "right" ? -rawDelta : rawDelta);
  };
  const handleDoubleClick = () => onCollapse?.();

  return (
    <div
      aria-label="Resize panel"
      aria-orientation="vertical"
      className={cn(
        "group relative z-30 h-full w-1.5 shrink-0 cursor-col-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      data-testid={`resize-handle-${side}`}
      role="separator"
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onLostPointerCapture={handleDragEnd}
      onPointerCancel={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
      {line ? (
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-border-strong" />
      ) : null}
      <div className="absolute inset-y-6 left-1/2 w-1 -translate-x-1/2 rounded-full bg-foreground/25 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
    </div>
  );
};
