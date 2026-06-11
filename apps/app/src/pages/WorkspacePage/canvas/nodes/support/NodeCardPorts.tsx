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
import { themeMap, type NodeTheme } from "./nodeCardTheme";

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
  theme: NodeTheme;
}

const nodePortClassName =
  "node-card-port absolute !top-[calc(50%+var(--node-port-offset))] !z-10 !h-0 !min-h-0 !w-0 !min-w-0 !border-0 !bg-transparent !opacity-100 transition-opacity duration-150 ease-out before:content-[''] before:absolute before:left-1/2 before:top-1/2 before:h-2 before:w-2 before:-translate-x-1/2 before:-translate-y-1/2 before:scale-75 before:rounded-full before:opacity-30 before:shadow-[0_0_0_2px_rgba(255,255,255,0.8),0_1px_4px_rgba(15,23,42,0.12)] before:transition-[opacity,transform,box-shadow] before:duration-200 before:ease-out after:content-[''] after:absolute after:left-1/2 after:top-1/2 after:h-5 after:w-5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full hover:before:scale-125 hover:before:opacity-100 hover:before:shadow-[0_0_0_3px_rgba(255,255,255,0.95),0_2px_8px_rgba(15,23,42,0.28)] group-hover/node-card:before:scale-100 group-hover/node-card:before:opacity-75 group-data-[selected=true]/node-card:before:scale-110 group-data-[selected=true]/node-card:before:opacity-100 data-[connected=true]:before:scale-100 data-[connected=true]:before:opacity-90 data-[active=true]:before:scale-125 data-[active=true]:before:opacity-100";

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
  theme,
}: NodeCardPortsProps) => {
  const { t } = useTranslation();
  const themeConfig = themeMap[theme] ?? themeMap.emerald;
  const nodeId = useNodeId();
  const updateNodeInternals = useUpdateNodeInternals();
  const leftPortOffsets = getNodePortOffsets(leftHandleCount, cardMaxPortSpread);
  const rightPortOffsets = getNodePortOffsets(rightHandleCount, cardMaxPortSpread);
  const leftPortClassName = cn(nodePortClassName, "!left-0", themeConfig.handleColor);
  const rightPortClassName = cn(nodePortClassName, "!right-0", themeConfig.handleColor);

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
