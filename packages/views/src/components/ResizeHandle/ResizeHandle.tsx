import { useEffect, useRef, type PointerEvent } from "react";
import { cn } from "@repo/ui/lib/utils";

export interface ResizeHandleProps {
  ariaLabel: string;
  line?: boolean;
  onCollapse?: () => void;
  onDelta: (delta: number) => void;
  onDragStart?: () => void;
  side: "left" | "right";
}

export const ResizeHandle = ({
  ariaLabel,
  line = true,
  onCollapse,
  onDelta,
  onDragStart,
  side,
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
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      cleanupRef.current = () => undefined;
    };

    cleanupRef.current = cleanup;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    globalThis.addEventListener("pointermove", handleMove);
    globalThis.addEventListener("pointerup", cleanup);
  };

  return (
    <div
      aria-label={ariaLabel}
      aria-orientation="vertical"
      className="group relative z-30 w-px shrink-0 self-stretch cursor-col-resize touch-none"
      data-testid={`resize-handle-${side}`}
      role="separator"
      onDoubleClick={onCollapse}
      onPointerDown={handlePointerDown}
    >
      <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
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
