import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import {
  ExecutionPortDefinitionSchema,
  ExecutionPortDefinitionsSchema,
} from "./ExecutionPortDefinitionSchema";

describe("execution port definitions", () => {
  it("separates omitted-port requirements from explicit empty-value policy", () => {
    const base = { id: "value", valueType: "text", cardinality: "one" };
    expect(ExecutionPortDefinitionSchema.parse(base)).toMatchObject({
      required: true,
      allowEmpty: false,
    });
    expect(
      ExecutionPortDefinitionSchema.parse({ ...base, required: false, allowEmpty: true }),
    ).toMatchObject({ required: false, allowEmpty: true });
  });

  it.each(
    [
      [""],
      ["   "],
      ["x".repeat(129)],
      ["text/plain", "text/plain"],
      Array.from({ length: 33 }, (_, i) => `application/x-${i}`),
    ].map((mimeTypes) => ({ mimeTypes })),
  )("rejects invalid MIME allowlist case %#", ({ mimeTypes }) => {
    expect(
      ExecutionPortDefinitionSchema.safeParse({
        id: "file",
        valueType: "artifact",
        cardinality: "one",
        mimeTypes,
      }).success,
    ).toBe(false);
  });

  it("publishes empty-value and MIME bounds in discoverable JSON Schema", () => {
    expect(z.toJSONSchema(ExecutionPortDefinitionSchema)).toMatchObject({
      additionalProperties: false,
      properties: {
        allowEmpty: { type: "boolean", default: false },
        required: { type: "boolean", default: true },
        mimeTypes: {
          type: "array",
          maxItems: 32,
          uniqueItems: true,
          items: { type: "string", minLength: 1, maxLength: 128 },
        },
      },
    });
  });
  it("preserves two distinct artifact ports and required defaults", () => {
    const ports = ExecutionPortDefinitionsSchema.parse([
      { id: "report", valueType: "artifact", cardinality: "one", mimeTypes: ["text/markdown"] },
      { id: "attachments", valueType: "artifact", cardinality: "many", required: false },
    ]);
    expect(ports.map(({ id, required }) => ({ id, required }))).toEqual([
      { id: "report", required: true },
      { id: "attachments", required: false },
    ]);
  });

  it("accepts an object JSON Schema without coercing it", () => {
    const jsonSchema = { type: "object", properties: { count: { type: "integer" } } };
    expect(
      ExecutionPortDefinitionSchema.parse({
        id: "data",
        valueType: "json",
        cardinality: "one",
        jsonSchema,
      }).jsonSchema,
    ).toEqual(jsonSchema);
  });

  it.each([
    { valueType: "text", mimeTypes: ["text/plain"] },
    { valueType: "artifact", jsonSchema: {} },
    { valueType: "json", jsonSchema: [] },
    { valueType: "json", jsonSchema: null },
    { valueType: "text", cardinality: "optional" },
    { valueType: "text", legacyType: "file" },
  ])("rejects incompatible or unknown port metadata: %j", (patch) => {
    expect(
      ExecutionPortDefinitionSchema.safeParse({
        id: "data",
        cardinality: "one",
        ...patch,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate port IDs and excessive port counts", () => {
    const port = { id: "value", valueType: "text", cardinality: "one" };
    expect(ExecutionPortDefinitionsSchema.safeParse([port, port]).success).toBe(false);
    expect(
      ExecutionPortDefinitionsSchema.safeParse(
        Array.from({ length: 65 }, (_, i) => ({ ...port, id: `p${i}` })),
      ).success,
    ).toBe(false);
  });

  it("rejects cyclic JSON metadata before recursively parsing it", () => {
    const jsonSchema: Record<string, unknown> = {};
    jsonSchema["self"] = jsonSchema;
    expect(
      ExecutionPortDefinitionSchema.safeParse({
        id: "value",
        valueType: "json",
        cardinality: "one",
        jsonSchema,
      }).success,
    ).toBe(false);
  });
});
