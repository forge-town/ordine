import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@repo/views/DashboardPage";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
