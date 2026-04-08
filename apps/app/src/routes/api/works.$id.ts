import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { worksDao } from "@/models/daos/worksDao";

const UpdateWorkStatusSchema = z.object({
  status: z.enum(["pending", "running", "success", "failed"]),
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/works/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const work = await worksDao.findById(params.id);
        if (!work) return error("Work not found", 404);
        return json(work);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdateWorkStatusSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const work = await worksDao.updateStatus(params.id, parsed.data.status);
        return json(work);
      },

      DELETE: async ({ params }) => {
        const existing = await worksDao.findById(params.id);
        if (!existing) return error("Work not found", 404);
        await worksDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
