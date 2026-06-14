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
        encodeCanvasComponentDragPayload({ kind: "compound", compoundKind: "verify" }),
      ),
    ).toEqual({ kind: "compound", compoundKind: "verify" });

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

  it("normalizes serialized operation payloads from dataTransfer", () => {
    const decoded = decodeCanvasComponentDragPayload(
      JSON.stringify({
        kind: "operation",
        operation: {
          ...validOperation,
          meta: {
            createdAt: "2026-06-08T03:43:27.439Z",
            updatedAt: "2026-06-08T05:21:58.014Z",
          },
          sourceSkillId: null,
        },
      }),
    );

    expect(decoded).toMatchObject({
      kind: "operation",
      operation: {
        id: validOperation.id,
        name: validOperation.name,
      },
    });
    expect(decoded?.kind === "operation" ? decoded.operation.sourceSkillId : "unexpected").toBe(
      undefined,
    );
    expect(
      decoded?.kind === "operation" ? decoded.operation.meta?.createdAt : undefined,
    ).toBeInstanceOf(Date);
  });

  it("rejects custom compound shell payloads", () => {
    expect(
      decodeCanvasComponentDragPayload(
        JSON.stringify({ kind: "compound", compoundKind: "custom" }),
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
