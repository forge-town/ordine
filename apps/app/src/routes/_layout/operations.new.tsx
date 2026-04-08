import { createFileRoute } from "@tanstack/react-router";
import { OperationCreatePage } from "@/pages/OperationCreatePage";
import { getSkills } from "@/services/skillsService";

export const Route = createFileRoute("/_layout/operations/new")({
  loader: () => getSkills(),
  component: OperationCreatePage,
});
