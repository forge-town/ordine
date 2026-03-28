import { createFileRoute } from "@tanstack/react-router";
import { HarnessCanvasPage } from "@/pages/HarnessCanvasPage";

export const Route = createFileRoute("/canvas")({
  component: HarnessCanvasPage,
});
