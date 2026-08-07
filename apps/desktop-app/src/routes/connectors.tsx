import { createFileRoute } from "@tanstack/react-router";
import { ConnectorsPage } from "@repo/views/ConnectorsPage";

export const Route = createFileRoute("/connectors")({ component: ConnectorsPage });
