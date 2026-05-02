import { Handle, Position, useNodeId, useUpdateNodeInternals } from "@xyflow/react";
import { cn } from "@repo/ui/lib/utils";
import { useEffect } from "react";
import { getNodePortOffsets, makeNodePortId, type NodePortSide } from "./nodePorts";
import { themeMap, type NodeTheme } from "./nodeCardTheme";

export interface NodeCardPortsProps {
  cardMaxPortSpread?: number;
  leftHandle?: boolean;
  leftHandleCount: number;
  rightHandle?: boolean;
  rightHandleCount: number;
  theme: NodeTheme;
}

const nodePortClassName =
  "node-card-port absolute !top-[calc(50%+var(--node-port-offset))] !z-10 !h-5 !w-5 rounded-full !border-0 !bg-transparent !opacity-100 transition-opacity duration-150 ease-out before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:shadow-[0_0_0_3px_rgba(255,255,255,0.95),0_2px_7px_rgba(15,23,42,0.22)] before:transition-transform before:duration-200 hover:before:scale-125";

const getNodePortStyle = (offset: number) =>
  ({
    "--node-port-offset": `${offset}px`,
  }) as React.CSSProperties;

const getNodePortPosition = (side: NodePortSide) =>
  side === "left" ? Position.Left : Position.Right;

export const NodeCardPorts = ({
  cardMaxPortSpread,
  leftHandle,
  leftHandleCount,
  rightHandle,
  rightHandleCount,
  theme,
}: NodeCardPortsProps) => {
  const t = themeMap[theme] ?? themeMap.emerald;
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const leftPortOffsets = getNodePortOffsets(leftHandleCount, cardMaxPortSpread);
  const rightPortOffsets = getNodePortOffsets(rightHandleCount, cardMaxPortSpread);

  useEffect(() => {
    if (!nodeId) {
      return;
    }

    updateNodeInternals(nodeId);
  }, [
    cardMaxPortSpread,
    leftHandle,
    leftHandleCount,
    nodeId,
    rightHandle,
    rightHandleCount,
    updateNodeInternals,
  ]);

  return (
    <>
      {leftHandle &&
        leftPortOffsets.map((offset, index) => (
          <Handle
            key={makeNodePortId("left", index)}
            className={cn(nodePortClassName, "!left-2.5 before:!left-0", t.handleColor)}
            id={makeNodePortId("left", index)}
            position={getNodePortPosition("left")}
            style={getNodePortStyle(offset)}
            type="target"
          />
        ))}
      {rightHandle &&
        rightPortOffsets.map((offset, index) => (
          <Handle
            key={makeNodePortId("right", index)}
            className={cn(nodePortClassName, "!right-2.5 before:!left-full", t.handleColor)}
            id={makeNodePortId("right", index)}
            position={getNodePortPosition("right")}
            style={getNodePortStyle(offset)}
            type="source"
          />
        ))}
    </>
  );
};
