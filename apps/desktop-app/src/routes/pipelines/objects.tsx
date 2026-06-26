import { createFileRoute } from "@tanstack/react-router";
import { ObjectsPage } from "@repo/views/ObjectsPage";

export const Route = createFileRoute("/pipelines/objects")({
  component: ObjectsPage,
});
