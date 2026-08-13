import type { Operation, Skill } from "@repo/schemas";
import { describe, expect, it } from "vitest";
import {
  decodeCanvasComponentDragPayload,
  encodeCanvasComponentDragPayload,
} from "./canvasComponentDragPayload";

const validOperation = {
  acceptedObjectTypes: ["file"],
  config: {
    inputs: [],
    outputs: [],
  },
  description: "Find correctness issues",
  id: "review-code",
  name: "Review Code",
} as Operation;

const validSkill = {
  category: "code-quality",
  description: "Use neverthrow",
  id: "skill-error-handling",
  label: "Error Handling",
  name: "error-handling",
  origin: "manual",
  sources: [],
  tags: ["neverthrow"],
} as Skill;

describe("Canvas V2 component drag payload", () => {
  it("decodes valid object, operation, compound, and skill payloads", () => {
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
        encodeCanvasComponentDragPayload({ compoundKind: "verify", kind: "compound" }),
      ),
    ).toEqual({ compoundKind: "verify", kind: "compound" });

    expect(
      decodeCanvasComponentDragPayload(
        encodeCanvasComponentDragPayload({ kind: "skill", skill: validSkill }),
      ),
    ).toEqual({ kind: "skill", skill: validSkill });
  });

  it("rejects malformed payloads", () => {
    expect(decodeCanvasComponentDragPayload("{")).toBeNull();
    expect(
      decodeCanvasComponentDragPayload(JSON.stringify({ kind: "object", type: "not-a-node" })),
    ).toBeNull();
    expect(
      decodeCanvasComponentDragPayload(
        JSON.stringify({ kind: "compound", compoundKind: "custom" }),
      ),
    ).toBeNull();
  });
});
