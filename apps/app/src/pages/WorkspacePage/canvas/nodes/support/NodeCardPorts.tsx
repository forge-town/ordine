import {
  Handle as ReactFlowPort,
  Position,
  useNodeId,
  useUpdateNodeInternals,
} from "@xyflow/react";
import { cn } from "@repo/ui/lib/utils";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getNodePortOffsets, makeNodePortId, type NodePortSide } from "./nodePorts";

export interface NodeCardPortsProps {
  cardMaxPortSpread?: number;
  leftActivePortCount?: number;
  leftActivePortMask?: number;
  leftConnectedPortCount?: number;
  leftConnectedPortMask?: number;
  leftHandle?: boolean;
  leftHandleCount: number;
  rightActivePortCount?: number;
  rightActivePortMask?: number;
  rightConnectedPortCount?: number;
  rightConnectedPortMask?: number;
  rightHandle?: boolean;
  rightHandleCount: number;
}

/**
 * Prototype canvas.jsx IO handles: always-visible 12px circles sitting on the
 * card edge (border-strong ring on surface), scaling up under the cursor.
 * Visuals live on ::before so xyflow's own transform on the handle is untouched;
 * ::after keeps a generous invisible hit area for linking.
 */
const nodePortClassName =
  "node-card-port absolute !top-[calc(50%+var(--node-port-offset))] !z-10 !h-0 !min-h-0 !w-0 !min-w-0 !border-0 !bg-transparent !opacity-100 cursor-crosshair before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:h-3 before:w-3 before:-translate-x-1/2 before:-translate-y-1/2 before:rounded-full before:border before:border-border-strong before:bg-surface before:shadow-[0_1px_2px_rgba(15,23,42,0.12)] before:transition-transform before:duration-150 before:ease-out after:content-[''] after:absolute after:left-1/2 after:top-1/2 after:h-5 after:w-5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full hover:before:scale-150 hover:before:border-foreground data-[connected=true]:before:border-foreground/60 data-[active=true]:before:scale-125 data-[active=true]:before:border-foreground";

const getNodePortStyle = (offset: number) =>
  ({
    "--node-port-offset": `${offset}px`,
  }) as React.CSSProperties;

const getNodePortPosition = (side: NodePortSide) =>
  side === "left" ? Position.Left : Position.Right;

const MAX_SAFE_PORT_INDEX = 52;
const MAX_SAFE_PORT_COUNT = MAX_SAFE_PORT_INDEX + 1;

const isSafePortIndex = (index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index <= MAX_SAFE_PORT_INDEX;

const makeLeadingPortMask = (count: number): number =>
  count <= 0 ? 0 : 2 ** Math.min(count, MAX_SAFE_PORT_COUNT) - 1;

const getPortIndexMask = (index: number): number => (isSafePortIndex(index) ? 2 ** index : 0);

const makeSequentialPortMask = (count: number, startIndex: number): number => {
  if (count <= 0 || !isSafePortIndex(startIndex)) {
    return 0;
  }

  return makeLeadingPortMask(Math.min(count, MAX_SAFE_PORT_COUNT - startIndex)) * 2 ** startIndex;
};

const hasPortIndex = (mask: number, index: number): boolean =>
  isSafePortIndex(index) ? Math.floor(mask / getPortIndexMask(index)) % 2 === 1 : false;

const getNodePortVisualState = (
  side: NodePortSide,
  index: number,
  leftConnectedPortCount: number,
  rightConnectedPortCount: number,
  leftActivePortCount: number,
  rightActivePortCount: number,
  leftConnectedPortMask?: number,
  rightConnectedPortMask?: number,
  leftActivePortMask?: number,
  rightActivePortMask?: number,
) => {
  const connectedPortCount = side === "left" ? leftConnectedPortCount : rightConnectedPortCount;
  const activePortCount = side === "left" ? leftActivePortCount : rightActivePortCount;
  const connectedPortMask =
    side === "left"
      ? (leftConnectedPortMask ?? makeLeadingPortMask(connectedPortCount))
      : (rightConnectedPortMask ?? makeLeadingPortMask(connectedPortCount));
  const activePortMask =
    side === "left"
      ? (leftActivePortMask ?? makeSequentialPortMask(activePortCount, connectedPortCount))
      : (rightActivePortMask ?? makeSequentialPortMask(activePortCount, connectedPortCount));
  const connected = hasPortIndex(connectedPortMask, index);
  const active = !connected && hasPortIndex(activePortMask, index);

  return {
    active,
    connected,
    state: active ? "active" : connected ? "connected" : "idle",
  };
};

export const NodeCardPorts = ({
  cardMaxPortSpread,
  leftActivePortCount = 0,
  leftActivePortMask,
  leftConnectedPortCount = 0,
  leftConnectedPortMask,
  leftHandle,
  leftHandleCount,
  rightActivePortCount = 0,
  rightActivePortMask,
  rightConnectedPortCount = 0,
  rightConnectedPortMask,
  rightHandle,
  rightHandleCount,
}: NodeCardPortsProps) => {
  const { t } = useTranslation();
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const leftPortOffsets = getNodePortOffsets(leftHandleCount, cardMaxPortSpread);
  const rightPortOffsets = getNodePortOffsets(rightHandleCount, cardMaxPortSpread);
  const leftPortClassName = cn(nodePortClassName, "!left-0");
  const rightPortClassName = cn(nodePortClassName, "!right-0");

  useEffect(() => {
    if (!nodeId) {
      return;
    }

    updateNodeInternals(nodeId);

    if (typeof requestAnimationFrame === "undefined") {
      return;
    }

    const frameId = requestAnimationFrame(() => updateNodeInternals(nodeId));
    const timeoutId = globalThis.setTimeout(() => updateNodeInternals(nodeId), 200);

    return () => {
      cancelAnimationFrame(frameId);
      globalThis.clearTimeout(timeoutId);
    };
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
        leftPortOffsets.map((offset, index) => {
          const visualState = getNodePortVisualState(
            "left",
            index,
            leftConnectedPortCount,
            rightConnectedPortCount,
            leftActivePortCount,
            rightActivePortCount,
            leftConnectedPortMask,
            rightConnectedPortMask,
            leftActivePortMask,
            rightActivePortMask,
          );

          return (
            <ReactFlowPort
              key={makeNodePortId("left", index)}
              aria-label={t("workspace.canvas.nodes.ports.left", { index: index + 1 })}
              className={leftPortClassName}
              data-active={visualState.active ? "true" : "false"}
              data-connected={visualState.connected ? "true" : "false"}
              data-port-state={visualState.state}
              data-testid="canvas-v2-node-left-port"
              id={makeNodePortId("left", index)}
              position={getNodePortPosition("left")}
              style={getNodePortStyle(offset)}
              type="target"
            />
          );
        })}
      {rightHandle &&
        rightPortOffsets.map((offset, index) => {
          const visualState = getNodePortVisualState(
            "right",
            index,
            leftConnectedPortCount,
            rightConnectedPortCount,
            leftActivePortCount,
            rightActivePortCount,
            leftConnectedPortMask,
            rightConnectedPortMask,
            leftActivePortMask,
            rightActivePortMask,
          );

          return (
            <ReactFlowPort
              key={makeNodePortId("right", index)}
              aria-label={t("workspace.canvas.nodes.ports.right", { index: index + 1 })}
              className={rightPortClassName}
              data-active={visualState.active ? "true" : "false"}
              data-connected={visualState.connected ? "true" : "false"}
              data-port-state={visualState.state}
              data-testid="canvas-v2-node-right-port"
              id={makeNodePortId("right", index)}
              position={getNodePortPosition("right")}
              style={getNodePortStyle(offset)}
              type="source"
            />
          );
        })}
    </>
  );
};
