import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { operationsDao } from "@/models/daos/operationsDao";
import { OBJECT_TYPES } from "@/models/tables/operations_table";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const ObjectTypeEnum = z.enum(OBJECT_TYPES);

const CreateOperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  config: z.string().default("{}"),
  acceptedObjectTypes: z.array(ObjectTypeEnum).default(["file", "folder", "project"]),
});

export const Route = createFileRoute("/api/operations")({
  server: {
    handlers: {
      GET: async () => {
        const operations = await operationsDao.findMany();
        return json(operations);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateOperationSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const operation = await operationsDao.create(parsed.data);
        return json(operation, 201);
      },
    },
  },
});
