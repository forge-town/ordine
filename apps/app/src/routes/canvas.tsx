import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { CanvasPage } from "@/pages/CanvasPage";
import { getPipelineById } from "@/services/pipelinesService";
import { getOperations } from "@/services/operationsService";

export const Route = createFileRoute("/canvas")({
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: async ({ deps }) => {
    const [pipeline, operations] = await Promise.all([
      deps.id ? getPipelineById({ data: { id: deps.id } }) : null,
      getOperations(),
    ]);
    return { pipeline, operations };
  },
  component: CanvasPage,
});
