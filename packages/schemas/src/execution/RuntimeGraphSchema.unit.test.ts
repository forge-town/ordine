import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { RuntimeGraphSchema } from "./RuntimeGraphSchema";

const node = (id: string) => ({ id, operation: { operationId: "op-one", revision: 2 } });
const edge = (id: string, sourceId: string, targetId: string) => ({
  id,
  source: { kind: "node", nodeId: sourceId, portId: "value" },
  target: { nodeId: targetId, portId: "value" },
  order: 0,
});
const port = { id: "source", valueType: "artifact", cardinality: "many" };
const graph = {
  schemaVersion: 2,
  inputs: [port],
  nodes: [node("producer"), node("consumer")],
  edges: [
    {
      id: "input-edge",
      source: { kind: "input", portId: "source" },
      target: { nodeId: "producer", portId: "source" },
      order: 0,
    },
    edge("output-edge", "producer", "consumer"),
  ],
  outputs: [{ port: { ...port, id: "result" }, source: { nodeId: "consumer", portId: "files" } }],
};

describe("runtime graphs", () => {
  it.each([
    { operator: "non_empty" },
    { operator: "equals", expected: { kind: "json", value: { status: "ready" } } },
    { operator: "contains", expected: "ready", negate: true },
  ])("preserves structured edge predicates %j", (condition) => {
    const parsed = RuntimeGraphSchema.parse({
      ...graph,
      edges: [{ ...edge("conditional", "producer", "consumer"), condition }],
    });
    expect(parsed.edges[0]?.condition).toEqual({ negate: false, ...condition });
  });

  it.each([
    { operator: "non_empty", expected: "unexpected" },
    { operator: "equals" },
    { operator: "equals", expected: "raw text" },
    { operator: "contains", expected: "" },
    { operator: "contains", expected: 1 },
    { operator: "eval", expression: "true" },
    { operator: "non_empty", unknown: true },
    { operator: "non_empty", negate: "false" },
  ])("rejects ambiguous or legacy predicates %j", (condition) => {
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        edges: [{ ...edge("conditional", "producer", "consumer"), condition }],
      }).success,
    ).toBe(false);
  });

  it("preserves bounded node loops without adding a loop to ordinary nodes", () => {
    const loop = {
      maxIterations: 20,
      until: { portId: "result", condition: { operator: "non_empty" } },
      feedback: [{ sourcePort: "result", targetPort: "input" }],
    };
    const parsed = RuntimeGraphSchema.parse({
      ...graph,
      nodes: [{ ...node("producer"), loop }, node("consumer")],
    });
    expect(parsed.nodes[0]?.loop).toEqual({
      ...loop,
      until: { portId: "result", condition: { operator: "non_empty", negate: false } },
    });
    expect(parsed.nodes[1]).not.toHaveProperty("loop");
    const withoutFeedback = { maxIterations: 1, until: loop.until };
    expect(
      RuntimeGraphSchema.parse({
        ...graph,
        nodes: [{ ...node("producer"), loop: withoutFeedback }, node("consumer")],
      }).nodes[0]?.loop?.feedback,
    ).toEqual([]);
  });

  it.each([
    { maxIterations: 0 },
    { maxIterations: 21 },
    { maxIterations: 1.5 },
    { until: { portId: "result", condition: { operator: "non_empty", expected: "legacy" } } },
    {
      feedback: [
        { sourcePort: "a", targetPort: "input" },
        { sourcePort: "b", targetPort: "input" },
      ],
    },
    { acceptLastResult: true },
  ])("rejects invalid loop bounds and feedback %j", (patch) => {
    const loop = {
      maxIterations: 2,
      until: { portId: "result", condition: { operator: "non_empty" } },
      ...patch,
    };
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        nodes: [{ ...node("producer"), loop }, node("consumer")],
      }).success,
    ).toBe(false);
  });

  it.each(
    [
      [""],
      [" "],
      ["x".repeat(129)],
      ["UNAVAILABLE", "UNAVAILABLE"],
      Array.from({ length: 33 }, (_, i) => `CODE_${i}`),
    ].map((retryableCodes) => ({ retryableCodes })),
  )("rejects ineffective retry code list case %#", ({ retryableCodes }) => {
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        nodes: [{ ...node("producer"), retry: { retryableCodes } }, node("consumer")],
      }).success,
    ).toBe(false);
  });

  it("publishes conditional edges, loops, and retry limits in JSON Schema", () => {
    expect(z.toJSONSchema(RuntimeGraphSchema)).toMatchObject({
      additionalProperties: false,
      properties: {
        nodes: {
          items: {
            properties: {
              loop: {
                additionalProperties: false,
                properties: {
                  maxIterations: { minimum: 1, maximum: 20 },
                  until: { properties: { condition: { oneOf: expect.any(Array) } } },
                },
              },
              retry: {
                properties: {
                  retryableCodes: {
                    maxItems: 32,
                    uniqueItems: true,
                    items: { minLength: 1, maxLength: 128 },
                  },
                },
              },
            },
          },
        },
        edges: {
          items: {
            properties: {
              condition: {
                oneOf: expect.arrayContaining([
                  expect.objectContaining({
                    additionalProperties: false,
                    properties: expect.objectContaining({
                      operator: { const: "non_empty", type: "string" },
                      negate: { type: "boolean", default: false },
                    }),
                  }),
                ]),
              },
            },
          },
        },
      },
    });
  });
  it("accepts an explicit DAG and fixed operation references with execution defaults", () => {
    const parsed = RuntimeGraphSchema.parse(graph);
    expect(parsed.nodes[0]).toEqual({
      ...node("producer"),
      executionOverrides: {},
      failurePolicy: "required",
      retry: { maxAttempts: 1, retryableCodes: [] },
      checkpoint: false,
    });
    expect(parsed.outputs[0]?.port.required).toBe(true);
  });

  it("keeps two distinct artifact bindings and declared fan-in order", () => {
    const parsed = RuntimeGraphSchema.parse({
      ...graph,
      edges: [
        {
          ...edge("report-edge", "producer", "consumer"),
          source: { kind: "node", nodeId: "producer", portId: "report" },
          order: 1,
        },
        {
          ...edge("appendix-edge", "producer", "consumer"),
          source: { kind: "node", nodeId: "producer", portId: "appendix" },
          order: 0,
        },
      ],
    });
    expect(parsed.edges.map(({ source, order }) => [source.portId, order])).toEqual([
      ["report", 1],
      ["appendix", 0],
    ]);
  });

  it("applies retry field defaults when only one retry setting is provided", () => {
    const parsed = RuntimeGraphSchema.parse({
      ...graph,
      nodes: [
        { ...node("producer"), retry: { maxAttempts: 2 } },
        { ...node("consumer"), retry: { retryableCodes: ["TEMPORARILY_UNAVAILABLE"] } },
      ],
    });
    expect(parsed.nodes.map(({ retry }) => retry)).toEqual([
      { maxAttempts: 2, retryableCodes: [] },
      { maxAttempts: 1, retryableCodes: ["TEMPORARILY_UNAVAILABLE"] },
    ]);
  });

  it.each([
    { nodes: [node("producer"), node("producer")] },
    { nodes: [{ id: "producer", operation: { operationId: "op-one" } }] },
    { nodes: [{ ...node("producer"), parentId: "group" }] },
    { nodes: [{ ...node("producer"), compound: true }] },
    { nodes: [{ ...node("producer"), retry: { maxAttempts: 4, retryableCodes: [] } }] },
    { edges: [edge("missing-source", "unknown", "consumer")] },
    { edges: [edge("missing-target", "producer", "unknown")] },
    { edges: [edge("self", "producer", "producer")] },
    { edges: [edge("same", "producer", "consumer"), edge("same", "producer", "consumer")] },
    { edges: [edge("first", "producer", "consumer"), edge("second", "producer", "consumer")] },
    { edges: [{ ...graph.edges[0], source: { kind: "input", portId: "unknown" } }] },
    { edges: [{ ...edge("fraction", "producer", "consumer"), order: 0.5 }] },
    { outputs: [{ port, source: { nodeId: "unknown", portId: "value" } }] },
    { outputs: [graph.outputs[0], graph.outputs[0]] },
    { inputs: [port, port] },
    { viewport: { x: 0, y: 0, zoom: 1 } },
    { schemaVersion: 1 },
  ])("rejects invalid or legacy graph structure: %j", (patch) => {
    expect(RuntimeGraphSchema.safeParse({ ...graph, ...patch }).success).toBe(false);
  });

  it("rejects a disconnected cycle even when a separate node is runnable", () => {
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        nodes: [node("entry"), node("a"), node("b"), node("c")],
        edges: [edge("ab", "a", "b"), edge("bc", "b", "c"), edge("ca", "c", "a")],
        outputs: [],
      }).success,
    ).toBe(false);
  });

  it("rejects legacy canvas node and edge payloads", () => {
    expect(
      RuntimeGraphSchema.safeParse({
        schemaVersion: 2,
        inputs: [],
        nodes: [
          {
            id: "a",
            data: { nodeType: "operation", operationId: "op-one" },
            position: { x: 0, y: 0 },
          },
        ],
        edges: [],
        outputs: [],
      }).success,
    ).toBe(false);
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        edges: [{ id: "old", source: "producer", target: "consumer", data: { mappings: [] } }],
      }).success,
    ).toBe(false);
  });

  it("enforces graph capacity before scheduling", () => {
    expect(
      RuntimeGraphSchema.safeParse({ ...graph, nodes: [], edges: [], outputs: [] }).success,
    ).toBe(false);
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        nodes: Array.from({ length: 201 }, (_, i) => node(`n${i}`)),
        edges: [],
        outputs: [],
      }).success,
    ).toBe(false);
    expect(
      RuntimeGraphSchema.safeParse({
        ...graph,
        edges: Array.from({ length: 501 }, (_, i) => ({
          ...edge(`e${i}`, "producer", "consumer"),
          source: { kind: "node", nodeId: "producer", portId: `p${i}` },
        })),
      }).success,
    ).toBe(false);
  });
});
