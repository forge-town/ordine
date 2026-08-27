import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@repo/views/HomePage";

export const Route = createFileRoute("/_layout/")({
  head: () => ({
    meta: [{ title: "Ordine Studio" }],
  }),
  component: HomePage,
});
