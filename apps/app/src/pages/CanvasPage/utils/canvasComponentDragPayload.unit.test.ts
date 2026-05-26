import type { Operation, Skill } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
  decodeCanvasComponentDragPayload,
  encodeCanvasComponentDragPayload,
} from "./canvasComponentDragPayload";

const validOperation = {
  id: "review-code",
  name: "Review Code",
  description: "Find correctness issues",
  acceptedObjectTypes: ["file"],
  config: {
    inputs: [],
    outputs: [],
  },
} as Operation;

const validSkill = {
  id: "skill-error-handling",
  name: "error-handling",
  label: "Error Handling",
  description: "Use neverthrow",
  category: "code-quality",
  tags: ["neverthrow"],
} as Skill;

describe("canvasComponentDragPayload", () => {
  it("decodes valid object, operation, and skill payloads", () => {
    expect(
      decodeCanvasComponentDragPayload(
        encodeCanvasComponentDragPayload({ kind: "object", type: "file" }),
      ),
    ).toEqual({ kind: "object", type: "file" });

    expect(
      decodeCanvasComponentDragPayload(
        encodeCanvasComponentDragPayload({ kind: "operation", operation: validOperation }),
      ),
    ).toEqual({ kind: "operation", operation: validOperation });

    expect(
      decodeCanvasComponentDragPayload(
        encodeCanvasComponentDragPayload({ kind: "skill", skill: validSkill }),
      ),
    ).toEqual({ kind: "skill", skill: validSkill });
  });

  it("rejects object payloads with unknown node types", () => {
    expect(
      decodeCanvasComponentDragPayload(JSON.stringify({ kind: "object", type: "not-a-node" })),
    ).toBeNull();
  });

  it("rejects operation payloads missing required fields", () => {
    expect(
      decodeCanvasComponentDragPayload(
        JSON.stringify({ kind: "operation", operation: { id: "review-code" } }),
      ),
    ).toBeNull();
  });

  it("rejects skill payloads missing required fields", () => {
    expect(
      decodeCanvasComponentDragPayload(
        JSON.stringify({ kind: "skill", skill: { id: "skill-error-handling" } }),
      ),
    ).toBeNull();
  });
});