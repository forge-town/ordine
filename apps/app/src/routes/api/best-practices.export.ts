import { createFileRoute } from "@tanstack/react-router";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import { checklistItemsDao } from "@/models/daos/checklistItemsDao";
import { json } from "@/lib/apiResponse";

export const Route = createFileRoute("/api/best-practices/export")({
  server: {
    handlers: {
      GET: async () => {
        const practices = await bestPracticesDao.findMany();
        const result = await Promise.all(
          practices.map(async (bp) => {
            const items = await checklistItemsDao.findByBestPracticeId(bp.id);
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
            };
          }),
        );
        return json(result);
      },
    },
  },
});
