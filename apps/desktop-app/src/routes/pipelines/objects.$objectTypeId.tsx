import { createFileRoute } from "@tanstack/react-router";
import { ObjectTypeDetailPage } from "@repo/views/ObjectTypeDetailPage";

export const Route = createFileRoute("/pipelines/objects/$objectTypeId")({
  component: ObjectTypeDetailPage,
});
