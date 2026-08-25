import { createFileRoute } from "@tanstack/react-router";
import { SchedulePage } from "@repo/views/SchedulePage";

export const Route = createFileRoute("/schedule")({
  component: SchedulePage,
});
