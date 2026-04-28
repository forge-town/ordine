export const DEFAULT_CANVAS_VIEWPORT = { x: 0, y: 0, zoom: 1.25 } as const;

export const formatZoomPercent = (zoom: number) => `${Math.round(zoom * 100)}%`;
