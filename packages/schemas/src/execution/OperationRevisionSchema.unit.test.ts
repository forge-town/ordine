import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { OperationRevisionSchema } from "./OperationRevisionSchema";

const operation = {
  apiVersion: 2,
  id: "op-one",
  revision: 3,
  name: "Write report",
  inputPorts: [],
  outputPorts: [],
  executor: {
    kind: "script",
    language: "javascript",
    source: "console.log('report')",
    outputMode: "text",
  },
};

describe("operation revisions", () => {
  it.each([
    { name: "n".repeat(241) },
    { description: "中".repeat(22_000) },
    { executor: { kind: "agent", instruction: "中".repeat(22_000) } },
    { executor: { kind: "agent", instruction: "work", systemPrompt: "中".repeat(22_000) } },
    { executor: { kind: "agent", instruction: " \n\t " } },
    { executor: { ...operation.executor, source: " \n\t " } },
  ])("rejects oversized or blank operation content case %#", (patch) => {
    expect(OperationRevisionSchema.safeParse({ ...operation, ...patch }).success).toBe(false);
  });

  it.each(
    [
      [""],
      [" "],
      ["x".repeat(257)],
      ["duplicate", "duplicate"],
      Array.from({ length: 65 }, (_, i) => `tool-${i}`),
    ].map((references) => ({ references })),
  )("rejects invalid capability/tool list case %#", ({ references }) => {
    expect(
      OperationRevisionSchema.safeParse({ ...operation, capabilityRefs: references }).success,
    ).toBe(false);
    expect(
      OperationRevisionSchema.safeParse({
        ...operation,
        executor: { kind: "agent", instruction: "work", allowedTools: references },
      }).success,
    ).toBe(false);
  });

  it("accepts the exact 64 KiB text boundary and 64 distinct references", () => {
    const text = "x".repeat(65_536);
    const references = Array.from({ length: 64 }, (_, i) => `tool-${i}`);
    expect(
      OperationRevisionSchema.safeParse({
        ...operation,
        name: "n".repeat(240),
        description: text,
        capabilityRefs: references,
        executor: {
          kind: "agent",
          instruction: text,
          systemPrompt: text,
          allowedTools: references,
        },
      }).success,
    ).toBe(true);
  });

  it("publishes operation limits and strict executor alternatives", () => {
    expect(z.toJSONSchema(OperationRevisionSchema)).toMatchObject({
      additionalProperties: false,
      properties: {
        name: { maxLength: 240 },
        description: { maxLength: 65_536 },
        capabilityRefs: {
          maxItems: 64,
          uniqueItems: true,
          items: { minLength: 1, maxLength: 256 },
        },
        executor: {
          oneOf: expect.arrayContaining([expect.objectContaining({ additionalProperties: false })]),
        },
      },
    });
  });
  it("keeps an explicit immutable revision and supplies only declared defaults", () => {
    expect(OperationRevisionSchema.parse(operation)).toEqual({
      ...operation,
      description: "",
      executionDefaults: {},
      capabilityRefs: [],
    });
  });

  it.each([
    { kind: "agent", instruction: "Produce a report", skillId: "skill-one" },
    { kind: "builtin", name: "materialize_file", config: { fileName: "report.md" } },
    { kind: "script", language: "python", source: "print('hello')", outputMode: "manifest" },
    { kind: "script", language: "bash", source: "printf hello", outputMode: "json" },
  ])("accepts declared executor %j", (executor) => {
    expect(OperationRevisionSchema.safeParse({ ...operation, executor }).success).toBe(true);
  });

  it.each([
    { revision: undefined },
    { revision: 0 },
    { apiVersion: 1 },
    { executor: { kind: "compound" } },
    { executor: { kind: "builtin", name: "unknown" } },
    { executor: { kind: "builtin", name: "identity", config: [] } },
    { executor: { kind: "agent", instruction: "" } },
    { executor: { ...operation.executor, source: "" } },
    { executor: { ...operation.executor, command: "legacy" } },
    { config: {} },
  ])("rejects unfixed revisions and unsupported execution: %j", (patch) => {
    expect(OperationRevisionSchema.safeParse({ ...operation, ...patch }).success).toBe(false);
  });

  it("bounds script source by UTF-8 bytes", () => {
    expect(
      OperationRevisionSchema.safeParse({
        ...operation,
        executor: { ...operation.executor, source: "x".repeat(65_536) },
      }).success,
    ).toBe(true);
    expect(
      OperationRevisionSchema.safeParse({
        ...operation,
        executor: { ...operation.executor, source: "中".repeat(22_000) },
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate IDs within a direction but allows matching input/output names", () => {
    const port = { id: "value", valueType: "text", cardinality: "one" };
    expect(
      OperationRevisionSchema.safeParse({ ...operation, inputPorts: [port, port] }).success,
    ).toBe(false);
    expect(
      OperationRevisionSchema.safeParse({ ...operation, inputPorts: [port], outputPorts: [port] })
        .success,
    ).toBe(true);
  });
});
