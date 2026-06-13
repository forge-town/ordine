import { createFileRoute } from "@tanstack/react-router";
import { ObjectTypeDetailPage } from "@/pages/ObjectTypeDetailPage";

export const Route = createFileRoute("/_layout/pipelines/objects/$objectTypeId")({
  component: ObjectTypeDetailPage,
});
