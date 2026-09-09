import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { jsonValueEqual } from "./jsonValueEqual";

describe("browser JSON equality", () => {
  it.each([
    [null, null],
    [null, {}],
    [1, "1"],
    [0, -0],
    [false, false],
    [
      { a: 1, b: [null, { c: true }] },
      { b: [null, { c: true }], a: 1 },
    ],
    [
      [1, 2],
      [2, 1],
    ],
    [[], {}],
    [[1], [1, 2]],
    [{ a: 1 }, { b: 1 }],
    [{ a: { b: 1 } }, { a: { b: 2 } }],
  ])("preserves strict JSON equality for %j and %j", (left, right) => {
    expect(jsonValueEqual(left, right)).toBe(isDeepStrictEqual(left, right));
  });
});
