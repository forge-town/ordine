import { createFileRoute } from "@tanstack/react-router";
import { ObjectTypePage } from "@/pages/ObjectTypePage";

export const Route = createFileRoute("/_layout/objects/$objectTypeId")({
  component: ObjectTypePage,
});
