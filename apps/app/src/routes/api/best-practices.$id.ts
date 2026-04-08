import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeSchema } from "@/schemas";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";

const UpdateBestPracticeSchema = BestPracticeSchema.partial().omit({
  id: true,
});

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) => json({ error: message }, status);

export const Route = createFileRoute("/api/best-practices/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const practice = await bestPracticesDao.findById(params.id);
        if (!practice) return error("Best practice not found", 404);
        return json(practice);
      },

      PATCH: async ({ request, params }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = UpdateBestPracticeSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const practice = await bestPracticesDao.update(params.id, parsed.data);
        return json(practice);
      },

      DELETE: async ({ params }) => {
        const existing = await bestPracticesDao.findById(params.id);
        if (!existing) return error("Best practice not found", 404);
        await bestPracticesDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
