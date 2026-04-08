import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { worksDao } from "@/models/daos/worksDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const UpdateWorkStatusSchema = z.object({
  status: z.enum(["pending", "running", "success", "failed"]),
});

export const Route = createFileRoute("/api/works/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const work = await worksDao.findById(params.id);
        if (!work) return errorResponse("Work not found", 404);
        return json(work);
      },

      PATCH: async ({ request, params }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = UpdateWorkStatusSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const work = await worksDao.updateStatus(params.id, parsed.data.status);
        return json(work);
      },

      DELETE: async ({ params }) => {
        const existing = await worksDao.findById(params.id);
        if (!existing) return errorResponse("Work not found", 404);
        await worksDao.delete(params.id);
        return new Response(null, { status: 204 });
      },
    },
  },
});
