import { describe, expect, it } from "vitest";
import { resolveInitialLanguage } from "./i18n";

describe("resolveInitialLanguage", () => {
  it.each([
    ["en", "en"],
    ["en-US", "en"],
    ["zh", "zh"],
    ["zh-CN", "zh"],
    [undefined, "zh"],
    ["unsupported", "zh"],
  ])("normalizes %s before the first render", (savedLanguage, expected) => {
    expect(resolveInitialLanguage(savedLanguage)).toBe(expected);
  });
});
