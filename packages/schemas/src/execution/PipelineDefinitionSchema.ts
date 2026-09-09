import { z } from "zod/v4";
import { EditorDocumentSchema } from "./EditorDocumentSchema";
import {
  ExecutionApiVersionSchema,
  ExecutionIdentifierSchema,
  ExecutionRevisionSchema,
} from "./ExecutionProtocolSchema";
import { RuntimeGraphSchema } from "./RuntimeGraphSchema";

export const PipelineDefinitionContentSchema = z.strictObject({
  name: z.string().min(1).max(240),
  description: z.string().max(16_384).default(""),
  sharedContext: z.string().max(65_536).default(""),
  graph: RuntimeGraphSchema,
  editor: EditorDocumentSchema.default({
    schemaVersion: 2,
    nodePositions: {},
    groups: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }),
});
export type PipelineDefinitionContent = z.infer<typeof PipelineDefinitionContentSchema>;

export const PipelineDefinitionSchema = z
  .strictObject({
    apiVersion: ExecutionApiVersionSchema,
    id: ExecutionIdentifierSchema,
    revision: ExecutionRevisionSchema,
    ...PipelineDefinitionContentSchema.shape,
  })
  .superRefine((value, context) => {
    const ids = new Set(value.graph.nodes.map((node) => node.id));
    for (const id of Object.keys(value.editor.nodePositions)) {
      if (!ids.has(id))
        context.addIssue({
          code: "custom",
          message: "Layout references an unknown runtime node",
          path: ["editor", "nodePositions", id],
        });
    }
    value.editor.groups.forEach((group, index) =>
      group.nodeIds.forEach((id, position) => {
        if (!ids.has(id))
          context.addIssue({
            code: "custom",
            message: "Group references an unknown runtime node",
            path: ["editor", "groups", index, "nodeIds", position],
          });
      }),
    );
  });
export type PipelineDefinition = z.infer<typeof PipelineDefinitionSchema>;

export const SavePipelineDefinitionSchema = z.strictObject({
  apiVersion: ExecutionApiVersionSchema,
  pipelineId: ExecutionIdentifierSchema,
  expectedRevision: z.number().int().nonnegative(),
  definition: PipelineDefinitionContentSchema,
});
export type SavePipelineDefinition = z.infer<typeof SavePipelineDefinitionSchema>;
