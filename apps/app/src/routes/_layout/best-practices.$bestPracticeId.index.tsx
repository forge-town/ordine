import { createFileRoute } from "@tanstack/react-router";
import { BestPracticeDetailPage } from "@/pages/BestPracticeDetailPage";
import { getBestPracticeById } from "@/services/bestPracticesService";
import { getChecklistItemsByBestPracticeId } from "@/services/checklistService";
import { getCodeSnippetsByBestPracticeId } from "@/services/codeSnippetsService";

export const Route = createFileRoute("/_layout/best-practices/$bestPracticeId/")({
  loader: async ({ params }) => {
    const [bestPractice, checklistItems, codeSnippets] = await Promise.all([
      getBestPracticeById({ data: { id: params.bestPracticeId } }),
      getChecklistItemsByBestPracticeId({
        data: { bestPracticeId: params.bestPracticeId },
      }),
      getCodeSnippetsByBestPracticeId({
        data: { bestPracticeId: params.bestPracticeId },
      }),
    ]);
    return { bestPractice, checklistItems, codeSnippets };
  },
  component: BestPracticeDetailPage,
});
