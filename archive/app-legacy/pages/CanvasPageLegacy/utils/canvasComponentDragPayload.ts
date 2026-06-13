import { Result } from "neverthrow";
import { BuiltinNodeTypeSchema, OperationSchema, SkillSchema } from "@repo/schemas";
import { z } from "zod/v4";

export const CANVAS_COMPONENT_DRAG_MIME = "application/x-ordine-canvas-component";

const CompoundShellKindSchema = z.enum(["verify", "council", "delegation"]);
const SerializedOperationSchema = OperationSchema.extend({
  sourceSkillId: z.string().nullable().optional(),
}).transform(({ sourceSkillId, ...operation }) => ({
  ...operation,
  ...(sourceSkillId === null || sourceSkillId === undefined ? {} : { sourceSkillId }),
}));

const CanvasComponentDragPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("object"),
    type: BuiltinNodeTypeSchema,
  }),
  z.object({
    kind: z.literal("operation"),
    operation: SerializedOperationSchema,
  }),
  z.object({
    kind: z.literal("compound"),
    compoundKind: CompoundShellKindSchema,
  }),
  z.object({
    kind: z.literal("skill"),
    skill: SkillSchema,
  }),
]);

export type CanvasComponentDragPayload = z.infer<typeof CanvasComponentDragPayloadSchema>;

const parseJson = Result.fromThrowable(JSON.parse, () => null);

export const encodeCanvasComponentDragPayload = (payload: CanvasComponentDragPayload): string =>
  JSON.stringify(payload);

export const hasCanvasComponentDragPayload = (types: DataTransfer["types"]): boolean =>
  [...types].includes(CANVAS_COMPONENT_DRAG_MIME);

export const decodeCanvasComponentDragPayload = (
  raw: string,
): CanvasComponentDragPayload | null => {
  const parsed = parseJson(raw);
  if (parsed.isErr()) {
    return null;
  }

  const payload = CanvasComponentDragPayloadSchema.safeParse(parsed.value);

  return payload.success ? payload.data : null;
};
