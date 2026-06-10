import { createFileRoute } from "@tanstack/react-router";
import { UsagePage } from "@/pages/UsagePage";

export const Route = createFileRoute("/_layout/usage")({
  head: () => ({
    meta: [{ title: "Usage | Ordine" }],
  }),
  component: UsagePage,
});
