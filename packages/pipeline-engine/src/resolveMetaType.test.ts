import { describe, it, expect } from "vitest";
import { resolveMetaType } from "./resolveMetaType";

describe("resolveMetaType", () => {
  it("returns 'object' for file type", () => {
    expect(resolveMetaType("file")).toBe("object");
  });

  it("returns 'object' for folder type", () => {
    expect(resolveMetaType("folder")).toBe("object");
  });

  it("returns 'operation' for operation type", () => {
    expect(resolveMetaType("operation")).toBe("operation");
  });

  it("returns 'output' for output-local-path type", () => {
    expect(resolveMetaType("output-local-path")).toBe("output");
  });

  it("returns 'output' for output-project-path type", () => {
    expect(resolveMetaType("output-project-path")).toBe("output");
  });

  it("defaults to 'object' for unknown types", () => {
    expect(resolveMetaType("custom-plugin")).toBe("object");
  });

  it("uses valid metaType when explicitly set", () => {
    expect(resolveMetaType("file", "operation")).toBe("operation");
    expect(resolveMetaType("file", "output")).toBe("output");
    expect(resolveMetaType("custom-plugin", "operation")).toBe("operation");
  });

  it("ignores invalid metaType and falls back to builtin map", () => {
    expect(resolveMetaType("operation", "input")).toBe("operation");
    expect(resolveMetaType("operation", "processor")).toBe("operation");
    expect(resolveMetaType("folder", "input")).toBe("object");
    expect(resolveMetaType("output-local-path", "processor")).toBe("output");
  });

  it("ignores invalid metaType and falls back to 'object' for unknown types", () => {
    expect(resolveMetaType("custom-plugin", "input")).toBe("object");
    expect(resolveMetaType("unknown", "processor")).toBe("object");
  });
});
