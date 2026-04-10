import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeEditPage } from "@/pages/BestPracticeEditPage";
import { getBestPracticeById } from "@/services/bestPracticesService";
import { getChecklistItemsByBestPracticeId } from "@/services/checklistService";

export const Route = createFileRoute("/_layout/best-practices/$bestPracticeId/edit")({
  loader: async ({ params }) => {
    const [bestPractice, checklistItems] = await Promise.all([
      getBestPracticeById({ data: { id: params.bestPracticeId } }),
      getChecklistItemsByBestPracticeId({
        data: { bestPracticeId: params.bestPracticeId },
      }),
    ]);
    return { bestPractice, checklistItems };
  },
  component: BestPracticeEditPage,
});
