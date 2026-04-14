import { createFileRoute } from "@tanstack/react-router";
import { CodeSnippetSchema } from "@/schemas";
import { codeSnippetsDao } from "@/models/daos/codeSnippetsDao";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

export const Route = createFileRoute("/api/code-snippets")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const bestPracticeId = url.searchParams.get("bestPracticeId");
        if (!bestPracticeId) {
          return errorResponse("bestPracticeId query param is required", 400);
        }
        const items = await codeSnippetsDao.findByBestPracticeId(bestPracticeId);
        return json(items);
      },

      PUT: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CodeSnippetSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const existing = await codeSnippetsDao.findById(parsed.data.id);
        if (existing) {
          const { id: _, bestPracticeId: __, ...patch } = parsed.data;
          const updated = await codeSnippetsDao.update(parsed.data.id, patch);
          return json(updated);
        }
        const item = await codeSnippetsDao.create(parsed.data);
        return json(item, 201);
      },

      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        if (!id) {
          return errorResponse("id query param is required", 400);
        }
        await codeSnippetsDao.delete(id);
        return json({ deleted: id });
      },
    },
  },
});
