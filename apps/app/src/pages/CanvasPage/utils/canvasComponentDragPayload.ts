import { Result } from "neverthrow";
import type { BuiltinNodeType, Operation, Skill } from "@repo/schemas";

export const CANVAS_COMPONENT_DRAG_MIME = "application/x-ordine-canvas-component";

export type CanvasComponentDragPayload =
  | {
      kind: "object";
      type: BuiltinNodeType;
    }
  | {
      kind: "operation";
      operation: Operation;
    }
  | {
      kind: "skill";
      skill: Skill;
    };

const parseJson = Result.fromThrowable(JSON.parse, () => null);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const encodeCanvasComponentDragPayload = (payload: CanvasComponentDragPayload): string =>
  JSON.stringify(payload);

export const hasCanvasComponentDragPayload = (types: DataTransfer["types"]): boolean =>
  [...types].includes(CANVAS_COMPONENT_DRAG_MIME);

export const decodeCanvasComponentDragPayload = (
  raw: string,
): CanvasComponentDragPayload | null => {
  const parsed = parseJson(raw);
  if (parsed.isErr() || !isRecord(parsed.value)) {
    return null;
  }

  if (parsed.value.kind === "object" && typeof parsed.value.type === "string") {
    return {
      kind: "object",
      type: parsed.value.type as BuiltinNodeType,
    };
  }

  if (parsed.value.kind === "operation" && isRecord(parsed.value.operation)) {
    return {
      kind: "operation",
      operation: parsed.value.operation as Operation,
    };
  }

  if (parsed.value.kind === "skill" && isRecord(parsed.value.skill)) {
    return {
      kind: "skill",
      skill: parsed.value.skill as Skill,
    };
  }

  return null;
};
