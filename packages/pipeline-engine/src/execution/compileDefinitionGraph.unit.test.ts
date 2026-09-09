import { describe, expect, it } from "vitest";
import { OperationRevisionSchema, RuntimeGraphSchema } from "@repo/schemas";
import { compileDefinitionGraph, validateOperationDefinition } from "./compileGraph";

const operation = () =>
  OperationRevisionSchema.parse({
    apiVersion: 2,
    id: "agent",
    revision: 1,
    name: "Draft Agent",
    inputPorts: [{ id: "in", valueType: "text", cardinality: "one" }],
    outputPorts: [{ id: "out", valueType: "text", cardinality: "one" }],
    executor: { kind: "agent", instruction: "Draft instruction" },
  });
const graph = () =>
  RuntimeGraphSchema.parse({
    schemaVersion: 2,
    inputs: [{ id: "source", valueType: "text", cardinality: "one" }],
    nodes: [{ id: "node", operation: { operationId: "agent", revision: 1 } }],
    edges: [
      {
        id: "binding",
        source: { kind: "input", portId: "source" },
        target: { nodeId: "node", portId: "in" },
        order: 0,
      },
    ],
    outputs: [
      {
        port: { id: "result", valueType: "text", cardinality: "one" },
        source: { nodeId: "node", portId: "out" },
      },
    ],
  });

describe("definition graph validation", () => {
  it("saves a structural Agent definition without runtime selection or actual input values", () => {
    const result = compileDefinitionGraph(graph(), [operation()]);
    expect(result.isOk()).toBe(true);
    if (result.isErr()) return;
    expect(result.value.nodes.get("node")?.executionOverrides).toEqual({});
    expect(result.value.operations.get("node")?.executionDefaults).toEqual({});
    expect(result.value).not.toHaveProperty("prepared");
    expect(result.value.levels.map((level) => level.map((node) => node.id))).toEqual([["node"]]);
  });

  it("requires exact pins and rejects missing, duplicate, extra, or wrong revisions", () => {
    expect(compileDefinitionGraph(graph(), []).isErr()).toBe(true);
    expect(compileDefinitionGraph(graph(), [operation(), operation()]).isErr()).toBe(true);
    expect(
      compileDefinitionGraph(graph(), [operation(), { ...operation(), id: "extra" }]).isErr(),
    ).toBe(true);
    expect(compileDefinitionGraph(graph(), [{ ...operation(), revision: 2 }]).isErr()).toBe(true);
  });

  it("still rejects undeclared ports and unknown builtin configuration", () => {
    const invalid = graph();
    invalid.edges[0]!.target.portId = "missing";
    expect(compileDefinitionGraph(invalid, [operation()]).isErr()).toBe(true);
    const builtin = {
      ...operation(),
      executor: { kind: "builtin" as const, name: "identity" as const, config: { unknown: true } },
    };
    expect(compileDefinitionGraph(graph(), [builtin]).isErr()).toBe(true);
  });

  it("validates standalone Operation ports, builtin config and JSON schemas without fake graph bindings", () => {
    expect(validateOperationDefinition(operation()).isOk()).toBe(true);
    const invalid = operation();
    invalid.inputPorts[0]!.valueType = "json";
    invalid.inputPorts[0]!.jsonSchema = { $ref: "#/unsupported" };
    expect(validateOperationDefinition(invalid).isErr()).toBe(true);
    const jsonGraph = graph();
    jsonGraph.inputs[0]!.valueType = "json";
    expect(compileDefinitionGraph(jsonGraph, [invalid]).isErr()).toBe(true);
    expect(
      validateOperationDefinition({
        ...operation(),
        executor: { kind: "builtin", name: "identity", config: { unknown: true } },
      }).isErr(),
    ).toBe(true);
  });
});
