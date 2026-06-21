import { createFileRoute } from "@tanstack/react-router";
import { RuntimesPage } from "@/pages/RuntimesPage";

export const Route = createFileRoute("/_layout/runtimes/")({
  head: () => ({
    meta: [{ title: "Runtimes | Ordine" }],
  }),
  component: RuntimesPage,
});
