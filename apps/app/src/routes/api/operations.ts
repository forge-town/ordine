import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { operationsDao } from "@repo/models";
import { OBJECT_TYPES } from "@repo/db-schema";
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

      PUT: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateOperationSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const existing = await operationsDao.findById(parsed.data.id);
        if (existing) {
          const { id: _, ...patch } = parsed.data;
          const updated = await operationsDao.update(parsed.data.id, patch);
          return json(updated);
        }
        const operation = await operationsDao.create(parsed.data);
        return json(operation, 201);
      },
    },
  },
});
