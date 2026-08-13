import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@repo/ui/lib/utils";

export interface ResizeHandleProps {
  ariaLabel: string;
  line?: boolean;
  max: number;
  min: number;
  onCollapse?: () => void;
  onDelta: (delta: number) => void;
  onDragStart?: () => void;
  side: "left" | "right";
  step?: number;
  value: number;
}

export const ResizeHandle = ({
  ariaLabel,
  line = true,
  max,
  min,
  onCollapse,
  onDelta,
  onDragStart,
  side,
  step = 8,
  value,
}: ResizeHandleProps) => {
  const cleanupRef = useRef<() => void>(() => undefined);
  const startXRef = useRef(0);

  useEffect(() => () => cleanupRef.current(), []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    cleanupRef.current();
    startXRef.current = event.clientX;
    onDragStart?.();

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      const rawDelta = moveEvent.clientX - startXRef.current;
      onDelta(side === "right" ? -rawDelta : rawDelta);
    };
    const cleanup = () => {
      globalThis.removeEventListener("pointermove", handleMove);
      globalThis.removeEventListener("pointerup", cleanup);
      globalThis.removeEventListener("pointercancel", cleanup);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      cleanupRef.current = () => undefined;
    };

    cleanupRef.current = cleanup;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    globalThis.addEventListener("pointermove", handleMove);
    globalThis.addEventListener("pointerup", cleanup);
    globalThis.addEventListener("pointercancel", cleanup);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    onDragStart?.();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    onDelta(side === "right" ? -direction * step : direction * step);
  };

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      className="group pointer-events-auto relative z-30 w-px shrink-0 self-stretch cursor-col-resize touch-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      data-testid={`resize-handle-${side}`}
      role="separator"
      tabIndex={0}
      onDoubleClick={onCollapse}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
    >
      <div className="absolute inset-y-0 -left-3 -right-3" />
      {line ? (
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-border-strong" />
      ) : null}
      <div
        className={cn(
          "absolute inset-y-6 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-foreground/25 opacity-0 transition-opacity group-hover:opacity-100",
        )}
      />
    </div>
  );
};
