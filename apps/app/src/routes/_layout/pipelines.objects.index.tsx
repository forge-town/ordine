import { createFileRoute } from "@tanstack/react-router";
import { ObjectsPage } from "@repo/views/ObjectsPage";

export const Route = createFileRoute("/_layout/pipelines/objects/")({
  component: ObjectsPage,
});
