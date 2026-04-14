import { createFileRoute } from "@tanstack/react-router";
import { bestPracticesDao, checklistItemsDao, codeSnippetsDao } from "@repo/models";
import { json } from "@/lib/apiResponse";

export const Route = createFileRoute("/api/best-practices/export")({
  server: {
    handlers: {
      GET: async () => {
        const practices = await bestPracticesDao.findMany();
        const result = await Promise.all(
          practices.map(async (bp) => {
            const [items, snippets] = await Promise.all([
              checklistItemsDao.findByBestPracticeId(bp.id),
              codeSnippetsDao.findByBestPracticeId(bp.id),
            ]);
            return {
              ...bp,
              checklistItems: items.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                checkType: item.checkType,
                script: item.script,
                sortOrder: item.sortOrder,
              })),
              codeSnippets: snippets.map((s) => ({
                id: s.id,
                title: s.title,
                language: s.language,
                code: s.code,
                sortOrder: s.sortOrder,
              })),
            };
          })
        );
        return json(result);
      },
    },
  },
});
