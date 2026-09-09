import { z } from "zod/v4";
import { ExecutionApiVersionSchema, ExecutionIdentifierSchema } from "./ExecutionProtocolSchema";

export const EditorPositionSchema = z.strictObject({
  x: z.number().finite(),
  y: z.number().finite(),
});
export type EditorPosition = z.infer<typeof EditorPositionSchema>;

const NodePositionsSchema = z.preprocess(
  (value, context) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (Object.keys(value).length > 200)
        context.addIssue({ code: "custom", message: "Too many layout node positions" });
      for (const key of Object.keys(value)) {
        if (!ExecutionIdentifierSchema.safeParse(key).success)
          context.addIssue({
            code: "custom",
            message: "Invalid layout node identifier",
            path: [key],
          });
      }
    }

    return value;
  },
  z.record(ExecutionIdentifierSchema, EditorPositionSchema).meta({ maxProperties: 200 }),
);

export const EditorGroupSchema = z.strictObject({
  id: ExecutionIdentifierSchema,
  label: z.string().max(240),
  nodeIds: z.array(ExecutionIdentifierSchema).max(200),
});
export type EditorGroup = z.infer<typeof EditorGroupSchema>;

export const EditorDocumentSchema = z
  .strictObject({
    schemaVersion: ExecutionApiVersionSchema,
    nodePositions: NodePositionsSchema.default({}),
    groups: z.array(EditorGroupSchema).max(200).default([]),
    viewport: z
      .strictObject({ ...EditorPositionSchema.shape, zoom: z.number().min(0.1).max(4) })
      .default({ x: 0, y: 0, zoom: 1 }),
  })
  .superRefine((document, context) => {
    const groupIds = new Set<string>();
    const groupedNodes = new Set<string>();
    document.groups.forEach((group, index) => {
      if (groupIds.has(group.id))
        context.addIssue({
          code: "custom",
          message: "Duplicate group identifier",
          path: ["groups", index, "id"],
        });
      groupIds.add(group.id);
      group.nodeIds.forEach((nodeId, nodeIndex) => {
        if (groupedNodes.has(nodeId))
          context.addIssue({
            code: "custom",
            message: "A node may belong to only one group and appear only once",
            path: ["groups", index, "nodeIds", nodeIndex],
          });
        groupedNodes.add(nodeId);
      });
    });
  });
export type EditorDocument = z.infer<typeof EditorDocumentSchema>;
