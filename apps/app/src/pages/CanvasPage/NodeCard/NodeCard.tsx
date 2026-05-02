import { memo, useLayoutEffect, useRef, useState } from "react";
import { NodeCardFrame, type NodeCardFrameProps } from "./NodeCardFrame";
import { NodeCardPorts } from "./NodeCardPorts";

export type { NodeTheme } from "./nodeCardTheme";

export interface NodeCardProps extends NodeCardFrameProps {
  leftHandle?: boolean;
  rightHandle?: boolean;
  leftHandleCount?: number;
  rightHandleCount?: number;
}

const useCardMaxPortSpread = (
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean
) => {
  const [cardMaxPortSpread, setCardMaxPortSpread] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!enabled) {
      setCardMaxPortSpread(undefined);

      return;
    }

    const card = wrapperRef.current?.querySelector<HTMLElement>('[data-slot="card"]');
    if (!card) {
      return;
    }

    const updateCardMaxPortSpread = () => {
      const height = card.offsetHeight;
      const nextMaxSpread =
        Number.isFinite(height) && height > 0 ? Math.floor(height / 2) : undefined;
      setCardMaxPortSpread((currentMaxSpread) =>
        currentMaxSpread === nextMaxSpread ? currentMaxSpread : nextMaxSpread
      );
    };

    updateCardMaxPortSpread();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateCardMaxPortSpread);
    observer.observe(card);

    return () => observer.disconnect();
  }, [enabled, wrapperRef]);

  return cardMaxPortSpread;
};

export const NodeCard = memo(
  ({
    leftHandle,
    rightHandle,
    leftHandleCount = 1,
    rightHandleCount = 1,
    selected,
    theme,
    icon,
    label,
    headerRight,
    children,
    bodyClassName,
    description,
    onLabelChange,
    runStatus,
    dimmed,
  }: NodeCardProps) => {
    const hasPorts = Boolean(leftHandle || rightHandle);
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const cardMaxPortSpread = useCardMaxPortSpread(wrapperRef, hasPorts);

    return (
      <div ref={wrapperRef} className="relative">
        <NodeCardFrame
          bodyClassName={bodyClassName}
          description={description}
          dimmed={dimmed}
          headerRight={headerRight}
          icon={icon}
          label={label}
          runStatus={runStatus}
          selected={selected}
          theme={theme}
          onLabelChange={onLabelChange}
        >
          {children}
        </NodeCardFrame>
        {hasPorts && (
          <NodeCardPorts
            cardMaxPortSpread={cardMaxPortSpread}
            leftHandle={leftHandle}
            leftHandleCount={leftHandleCount}
            rightHandle={rightHandle}
            rightHandleCount={rightHandleCount}
            theme={theme}
          />
        )}
      </div>
    );
  }
);
NodeCard.displayName = "NodeCard";
