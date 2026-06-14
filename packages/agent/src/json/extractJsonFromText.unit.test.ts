import { describe, expect, it } from "vitest";
import { extractJsonFromText } from "./extractJsonFromText";

describe("extractJsonFromText", () => {
  it("parses bare JSON and normalizes to 2-space indent", () => {
    expect(extractJsonFromText('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it("extracts JSON from a ```json fenced block", () => {
    const input = 'here you go:\n```json\n{"a": 1, "b": 2}\n```\nthanks';
    expect(extractJsonFromText(input)).toBe('{\n  "a": 1,\n  "b": 2\n}');
  });

  it("extracts the first {...} substring when surrounded by prose", () => {
    expect(extractJsonFromText('blah {"x":true} trailing')).toBe('{\n  "x": true\n}');
  });

  it("returns trimmed original when no JSON is present", () => {
    expect(extractJsonFromText("  no json here  ")).toBe("no json here");
  });
});
