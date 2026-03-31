import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { HarnessCanvasPage } from "@/pages/HarnessCanvasPage";
import { getPipelineById } from "@/services/pipelinesService";

export const Route = createFileRoute("/canvas")({
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    if (!deps.id) return null;
    return getPipelineById({ data: { id: deps.id } });
  },
  component: HarnessCanvasPage,
});
