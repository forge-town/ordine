import { createFileRoute } from "@tanstack/react-router";
import { ConnectorsPage } from "@repo/views/ConnectorsPage";

export const Route = createFileRoute("/_layout/connectors")({
  head: () => ({ meta: [{ title: "Connectors | Ordine" }] }),
  component: ConnectorsPage,
});
