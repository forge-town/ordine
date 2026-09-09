import { describe, expect, it } from "vitest";
import type { OperationConfigInput } from "@repo/schemas";
import {
  changeOperationInputType,
  cloneOperationPorts,
  createOperationInputPort,
  createOperationOutputPort,
  OperationPortFieldsSchema,
} from "./operationPortFields";

const fixture = (): OperationConfigInput => ({
  executor: {
    type: "script",
    language: "javascript",
    command: "console.log('hello')",
    outputMode: "text",
  },
  inputs: [
    {
      id: "source",
      name: "Source",
      kind: "prompt",
      accepts: ["text/plain", "text/markdown"],
      required: true,
      cardinality: "many",
      description: "Original input description",
    },
  ],
  outputs: [
    {
      id: "result",
      name: "Result",
      contentType: "markdown",
      produces: ["text/markdown"],
      required: false,
      cardinality: "one",
      description: "Original output description",
      templateIds: ["template-a", "template-b"],
    },
  ],
});

describe("operation port form fields", () => {
  it("preserves inputs and all output metadata across initialization, an ID/name edit and validation for saving", () => {
    const config = fixture();
    const fields = cloneOperationPorts(config);
    fields.inputs[0]!.id = "renamed-source";
    fields.outputs[0]!.name = "Renamed result";
    const validated = OperationPortFieldsSchema.safeParse(fields);
    expect(validated.success).toBe(true);
    if (!validated.success) return;
    const saved = { ...config, ...validated.data };
    expect(saved.inputs).toEqual([{ ...config.inputs![0], id: "renamed-source" }]);
    expect(saved.outputs).toEqual([{ ...config.outputs![0], name: "Renamed result" }]);
    expect(saved.executor).toEqual(config.executor);
    expect(config.inputs![0]!.id).toBe("source");
    expect(config.outputs![0]!.name).toBe("Result");
  });

  it("does not invent IDs or required/cardinality settings for old rows", () => {
    const fields = cloneOperationPorts({
      inputs: [{ name: "Old input", kind: "prompt", required: true }],
      outputs: [{ name: "Old output", contentType: "text", templateIds: ["keep"] }],
    });
    expect(fields.inputs[0]).not.toHaveProperty("id");
    expect(fields.outputs[0]).not.toHaveProperty("required");
    expect(fields.outputs[0]).not.toHaveProperty("cardinality");
    expect(OperationPortFieldsSchema.safeParse(fields).success).toBe(false);
    expect(fields.outputs[0]!.templateIds).toEqual(["keep"]);
  });

  it("only assigns new rows visible, collision-free IDs and explicit defaults", () => {
    const firstInput = createOperationInputPort([]);
    const secondInput = createOperationInputPort([firstInput]);
    const firstOutput = createOperationOutputPort([]);
    const secondOutput = createOperationOutputPort([firstOutput]);
    expect([firstInput.id, secondInput.id, firstOutput.id, secondOutput.id]).toEqual([
      "input-1",
      "input-2",
      "output-1",
      "output-2",
    ]);
    expect(
      OperationPortFieldsSchema.safeParse({
        inputs: [firstInput, secondInput],
        outputs: [firstOutput, secondOutput],
      }).success,
    ).toBe(true);
  });

  it("maps an explicit JSON/text selection to prompt + accepts while retaining other input metadata", () => {
    const port = cloneOperationPorts(fixture()).inputs[0]!;
    const json = changeOperationInputType(port, "json");
    expect(json).toEqual({ ...port, kind: "prompt", accepts: ["application/json"] });
    expect(changeOperationInputType(json, "text")).toEqual({
      ...port,
      kind: "prompt",
      accepts: ["text/plain"],
    });
    expect(port.accepts).toEqual(["text/plain", "text/markdown"]);
  });

  it("rejects duplicate stable IDs without rewriting either row", () => {
    const port = createOperationOutputPort([]);
    const fields = { inputs: [], outputs: [port, { ...port, name: "Other" }] };
    const result = OperationPortFieldsSchema.safeParse(fields);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]!.path).toEqual(["outputs", 1, "id"]);
    expect(fields.outputs.map((output) => output.id)).toEqual(["output-1", "output-1"]);
  });
});
