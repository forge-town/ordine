import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { operationsDao } from "@/models/daos/operationsDao";
import {
  VISIBILITY_OPTIONS,
  OBJECT_TYPES,
} from "@/models/tables/operations_table";

const VisibilityEnum = z.enum(VISIBILITY_OPTIONS);
const ObjectTypeEnum = z.enum(OBJECT_TYPES);

const UpdateOperationSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  category: z.string().optional(),
  visibility: VisibilityEnum.optional(),
  config: z.string().optional(),
  acceptedObjectTypes: z.array(ObjectTypeEnum).optional(),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/operations/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const operation = await operationsDao.findById(params.id);
        if (!operation) return error("Operation not found", 404);
        return json(operation);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdateOperationSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const operation = await operationsDao.update(params.id, parsed.data);
        return json(operation);
      },

      DELETE: async ({ params }) => {
        const existing = await operationsDao.findById(params.id);
        if (!existing) return error("Operation not found", 404);
        await operationsDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
