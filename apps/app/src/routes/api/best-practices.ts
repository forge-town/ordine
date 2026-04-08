import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeSchema } from "@/schemas";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const CreateBestPracticeSchema = BestPracticeSchema;

export const Route = createFileRoute("/api/best-practices")({
  server: {
    handlers: {
      GET: async () => {
        const practices = await bestPracticesDao.findMany();
        return json(practices);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateBestPracticeSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const practice = await bestPracticesDao.create(parsed.data);
        return json(practice, 201);
      },
    },
  },
});
