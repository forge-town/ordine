import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { operationsDao } from "@/models/daos/operationsDao";
import { OBJECT_TYPES } from "@/models/tables/operations_table";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const ObjectTypeEnum = z.enum(OBJECT_TYPES);

const UpdateOperationSchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  config: z.string().optional(),
  acceptedObjectTypes: z.array(ObjectTypeEnum).optional(),
});

export const Route = createFileRoute("/api/operations/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const operation = await operationsDao.findById(params.id);
        if (!operation) return errorResponse("Operation not found", 404);
        return json(operation);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdateOperationSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const operation = await operationsDao.update(params.id, parsed.data);
        return json(operation);
      },

      DELETE: async ({ params }) => {
        const existing = await operationsDao.findById(params.id);
        if (!existing) return errorResponse("Operation not found", 404);
        await operationsDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
