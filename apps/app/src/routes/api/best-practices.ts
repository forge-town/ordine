import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeSchema } from "@/schemas";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";

const CreateBestPracticeSchema = BestPracticeSchema;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const error = (message: string, status: number) =>
  json({ error: message }, status);

export const Route = createFileRoute("/api/best-practices")({
  server: {
    handlers: {
      GET: async () => {
        const practices = await bestPracticesDao.findMany();
        return json(practices);
      },

      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return error("Invalid JSON body", 400);
        }

        const parsed = CreateBestPracticeSchema.safeParse(body);
        if (!parsed.success) {
          return error(parsed.error.message, 400);
        }

        const practice = await bestPracticesDao.create(parsed.data);
        return json(practice, 201);
      },
    },
  },
});
