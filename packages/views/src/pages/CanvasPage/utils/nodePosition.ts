import type { NodeOrigin, XYPosition } from "@xyflow/system";

export const CONNECTION_MENU_NODE_OFFSET = { x: 40, y: -40 } as const;
export const DUPLICATE_NODE_OFFSET = { x: 40, y: 40 } as const;
export const NODE_CONTEXT_CONNECT_OFFSET = { x: 280, y: 0 } as const;
export const QUICK_ADD_NODE_ORIGIN: NodeOrigin = [0.5, 0.5];

interface ScreenViewportSize {
  innerWidth: number;
  innerHeight: number;
}

interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const DEFAULT_SCREEN_VIEWPORT: ScreenViewportSize = {
  innerWidth: 1280,
  innerHeight: 720,
};

const getCurrentScreenViewport = (): ScreenViewportSize => {
  if (typeof globalThis.innerWidth === "number" && typeof globalThis.innerHeight === "number") {
    return {
      innerWidth: globalThis.innerWidth,
      innerHeight: globalThis.innerHeight,
    };
  }

  return DEFAULT_SCREEN_VIEWPORT;
};

export const offsetPosition = (position: XYPosition, offset: Readonly<XYPosition>): XYPosition => ({
  x: position.x + offset.x,
  y: position.y + offset.y,
});

export const getScreenViewportCenter = (viewport?: ScreenViewportSize): XYPosition => {
  const screenViewport = viewport ?? getCurrentScreenViewport();

  return {
    x: screenViewport.innerWidth / 2,
    y: screenViewport.innerHeight / 2,
  };
};

export const getViewportRectCenter = (rect: ViewportRect): XYPosition => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});
