import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { operationsDao } from "@/models/daos/operationsDao";
import { VISIBILITY_OPTIONS, OBJECT_TYPES } from "@/models/tables/operations_table";

const VisibilityEnum = z.enum(VISIBILITY_OPTIONS);
const ObjectTypeEnum = z.enum(OBJECT_TYPES);

const CreateOperationSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().default(null),
  category: z.string().default("general"),
  visibility: VisibilityEnum.default("public"),
  config: z.string().default("{}"),
  acceptedObjectTypes: z.array(ObjectTypeEnum).default(["file", "folder", "project"]),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) => json({ error: message }, status);

export const Route = createFileRoute("/api/operations")({
  server: {
    handlers: {
      GET: async () => {
        const operations = await operationsDao.findMany();
        return json(operations);
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreateOperationSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const operation = await operationsDao.create(parsed.data);
        return json(operation, 201);
      },
    },
  },
});
