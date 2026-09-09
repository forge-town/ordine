import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { EditorDocumentSchema } from "./EditorDocumentSchema";

describe("editor documents", () => {
  it("accepts the layout capacity boundary", () => {
    const nodeIds = Array.from({ length: 200 }, (_, i) => `node-${i}`);
    const nodePositions = Object.fromEntries(nodeIds.map((id) => [id, { x: 0, y: 0 }]));
    expect(
      EditorDocumentSchema.safeParse({
        schemaVersion: 2,
        nodePositions,
        groups: [{ id: "group", label: "x".repeat(240), nodeIds }],
      }).success,
    ).toBe(true);
  });

  it.each([
    {
      nodePositions: Object.fromEntries(
        Array.from({ length: 201 }, (_, i) => [`node-${i}`, { x: 0, y: 0 }]),
      ),
    },
    {
      groups: Array.from({ length: 201 }, (_, i) => ({ id: `group-${i}`, label: "", nodeIds: [] })),
    },
    {
      groups: [
        { id: "group", label: "", nodeIds: Array.from({ length: 201 }, (_, i) => `node-${i}`) },
      ],
    },
    { groups: [{ id: "group", label: "x".repeat(241), nodeIds: [] }] },
  ])("rejects excessive layout payload case %#", (patch) => {
    expect(EditorDocumentSchema.safeParse({ schemaVersion: 2, ...patch }).success).toBe(false);
  });

  it("publishes layout capacity in discoverable JSON Schema", () => {
    expect(z.toJSONSchema(EditorDocumentSchema)).toMatchObject({
      additionalProperties: false,
      properties: {
        nodePositions: { type: "object", maxProperties: 200 },
        groups: {
          maxItems: 200,
          items: { properties: { label: { maxLength: 240 }, nodeIds: { maxItems: 200 } } },
        },
      },
    });
  });
  it("defaults presentation separately from execution", () => {
    expect(EditorDocumentSchema.parse({ schemaVersion: 2 })).toEqual({
      schemaVersion: 2,
      nodePositions: {},
      groups: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });
  });

  it("preserves finite layout and groups without interpreting them as executable nodes", () => {
    const document = {
      schemaVersion: 2,
      nodePositions: { first: { x: -100.25, y: 32 } },
      groups: [{ id: "group-one", label: "Sources", nodeIds: ["first", "second"] }],
      viewport: { x: 10, y: 20, zoom: 0.1 },
    };
    expect(EditorDocumentSchema.parse(document)).toEqual(document);
  });

  it.each([
    { nodePositions: { first: { x: Infinity, y: 0 } } },
    { nodePositions: { first: { x: 0, y: Number.NaN } } },
    { nodePositions: { first: { x: 0, y: 0, parentId: "legacy" } } },
    { nodePositions: JSON.parse('{"__proto__":{"x":0,"y":0}}') },
    { viewport: { x: 0, y: 0, zoom: 0.09 } },
    { viewport: { x: 0, y: 0, zoom: 4.01 } },
    { viewport: { x: "0", y: 0, zoom: 1 } },
    { groups: [{ id: "g", label: "G", nodeIds: ["a", "a"] }] },
    {
      groups: [
        { id: "g", label: "G", nodeIds: [] },
        { id: "g", label: "G", nodeIds: [] },
      ],
    },
    {
      groups: [
        { id: "g", label: "G", nodeIds: ["a"] },
        { id: "h", label: "H", nodeIds: ["a"] },
      ],
    },
    { nodes: [] },
    { schemaVersion: 1 },
  ])("rejects invalid or ambiguous layout: %j", (patch) => {
    expect(EditorDocumentSchema.safeParse({ schemaVersion: 2, ...patch }).success).toBe(false);
  });
});
