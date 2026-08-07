import { createFileRoute } from "@tanstack/react-router";
import { UsagePage } from "@repo/views/UsagePage";

export const Route = createFileRoute("/usage")({ component: UsagePage });
