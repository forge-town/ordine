import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeSchema } from "@repo/schemas";
import { bestPracticesDao } from "@repo/models";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const UpdateBestPracticeSchema = BestPracticeSchema.partial().omit({
  id: true,
});

export const Route = createFileRoute("/api/best-practices/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const practice = await bestPracticesDao.findById(params.id);
        if (!practice) return errorResponse("Best practice not found", 404);
        return json(practice);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdateBestPracticeSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const practice = await bestPracticesDao.update(params.id, parsed.data);
        return json(practice);
      },

      DELETE: async ({ params }) => {
        const existing = await bestPracticesDao.findById(params.id);
        if (!existing) return errorResponse("Best practice not found", 404);
        await bestPracticesDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
