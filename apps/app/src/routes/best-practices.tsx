import { createFileRoute } from "@tanstack/react-router";
import { BestPracticesPage } from "@/pages/BestPracticesPage";
import { getBestPractices } from "@/services/bestPracticesService";

export const Route = createFileRoute("/best-practices")({
  loader: () => getBestPractices(),
  component: BestPracticesPage,
});
