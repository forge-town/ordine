import { createFileRoute } from "@tanstack/react-router";
import { ChecklistItemSchema } from "@repo/schemas";
import { checklistItemsDao } from "@repo/models";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

export const Route = createFileRoute("/api/checklist-items")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const bestPracticeId = url.searchParams.get("bestPracticeId");
        if (!bestPracticeId) {
          return errorResponse("bestPracticeId query param is required", 400);
        }
        const items = await checklistItemsDao.findByBestPracticeId(bestPracticeId);
        return json(items);
      },

      PUT: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = ChecklistItemSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const existing = await checklistItemsDao.findById(parsed.data.id);
        if (existing) {
          const { id: _, bestPracticeId: __, ...patch } = parsed.data;
          const updated = await checklistItemsDao.update(parsed.data.id, patch);
          return json(updated);
        }
        const item = await checklistItemsDao.create(parsed.data);
        return json(item, 201);
      },

      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
          return errorResponse("id query param is required", 400);
        }
        await checklistItemsDao.delete(id);
        return json({ deleted: id });
      },
    },
  },
});
