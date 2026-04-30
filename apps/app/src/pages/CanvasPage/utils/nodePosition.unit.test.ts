import { describe, expect, it } from "vitest";
import {
  CONNECTION_MENU_NODE_OFFSET,
  DUPLICATE_NODE_OFFSET,
  NODE_CONTEXT_CONNECT_OFFSET,
  QUICK_ADD_NODE_ORIGIN,
  getScreenViewportCenter,
  getViewportRectCenter,
  offsetPosition,
} from "./nodePosition";

describe("nodePosition", () => {
  it("keeps named offsets stable", () => {
    expect(CONNECTION_MENU_NODE_OFFSET).toEqual({ x: 40, y: -40 });
    expect(DUPLICATE_NODE_OFFSET).toEqual({ x: 40, y: 40 });
    expect(NODE_CONTEXT_CONNECT_OFFSET).toEqual({ x: 280, y: 0 });
    expect(QUICK_ADD_NODE_ORIGIN).toEqual([0.5, 0.5]);
  });

  it("applies offsets without mutating the source position", () => {
    const position = { x: 100, y: 200 };
    const result = offsetPosition(position, NODE_CONTEXT_CONNECT_OFFSET);

    expect(result).toEqual({ x: 380, y: 200 });
    expect(position).toEqual({ x: 100, y: 200 });
  });

  it("returns the current screen viewport center", () => {
    expect(getScreenViewportCenter({ innerWidth: 1000, innerHeight: 800 })).toEqual({
      x: 500,
      y: 400,
    });
  });

  it("returns the center of an offset viewport rect", () => {
    expect(getViewportRectCenter({ left: 240, top: 72, width: 960, height: 640 })).toEqual({
      x: 720,
      y: 392,
    });
  });
});
