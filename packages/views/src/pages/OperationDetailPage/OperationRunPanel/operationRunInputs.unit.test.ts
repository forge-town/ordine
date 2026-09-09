import { describe, expect, it } from "vitest";
import { ExecutionPortDefinitionSchema } from "@repo/schemas";
import { parseOperationRunInputs } from "./operationRunInputs";

const port = ExecutionPortDefinitionSchema.parse({
  id: "input",
  valueType: "text",
  cardinality: "one",
});
describe("Operation explicit run inputs", () => {
  it("allows zero-input operations", async () => {
    await expect(parseOperationRunInputs([], {})).resolves.toEqual({});
  });
  it("preserves text and ordered many values", async () => {
    await expect(parseOperationRunInputs([port], { input: "  text\n" })).resolves.toEqual({
      input: [{ kind: "text", value: "  text\n" }],
    });
    await expect(
      parseOperationRunInputs([{ ...port, cardinality: "many" }], { input: '["a","b"]' }),
    ).resolves.toEqual({
      input: [
        { kind: "text", value: "a" },
        { kind: "text", value: "b" },
      ],
    });
  });
  it("distinguishes JSON arrays from cardinality many", async () => {
    await expect(
      parseOperationRunInputs([{ ...port, valueType: "json" }], { input: "[1,2]" }),
    ).resolves.toEqual({ input: [{ kind: "json", value: [1, 2] }] });
    await expect(
      parseOperationRunInputs([{ ...port, valueType: "json", cardinality: "many" }], {
        input: "[1,2]",
      }),
    ).resolves.toEqual({
      input: [
        { kind: "json", value: 1 },
        { kind: "json", value: 2 },
      ],
    });
  });
  it("rejects malformed JSON, missing and empty required values", async () => {
    await expect(
      parseOperationRunInputs([{ ...port, valueType: "json" }], { input: "{" }),
    ).rejects.toThrow("JSON 格式无效");
    await expect(parseOperationRunInputs([port], {})).rejects.toThrow("input");
    await expect(parseOperationRunInputs([port], { input: "" })).rejects.toThrow("input");
    await expect(
      parseOperationRunInputs([{ ...port, cardinality: "many" }], { input: '"text"' }),
    ).rejects.toThrow("JSON 数组");
  });
  it("validates actual JSON schema and diagnoses unsupported artifacts", async () => {
    await expect(
      parseOperationRunInputs([{ ...port, valueType: "json", jsonSchema: { type: "number" } }], {
        input: '"wrong"',
      }),
    ).rejects.toThrow("input");
    await expect(parseOperationRunInputs([{ ...port, valueType: "artifact" }], {})).rejects.toThrow(
      "文件端口",
    );
  });
  it("omits optional empty fields", async () => {
    await expect(
      parseOperationRunInputs([{ ...port, required: false }], { input: "" }),
    ).resolves.toEqual({});
  });
});
