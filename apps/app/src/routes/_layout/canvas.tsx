import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { CanvasPage } from "@/pages/CanvasPage";

export const Route = createFileRoute("/_layout/canvas")({
  validateSearch: z.object({
    id: z.string().optional(),
  }),
  component: CanvasPage,
});
