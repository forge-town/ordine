import { createFileRoute } from "@tanstack/react-router";
import { SchedulePage } from "@repo/views/SchedulePage";

export const Route = createFileRoute("/_layout/schedule")({
  head: () => ({
    meta: [{ title: "Schedule | Ordine" }],
  }),
  component: SchedulePage,
});
