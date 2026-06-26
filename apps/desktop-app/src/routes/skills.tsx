import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@repo/views/SkillsPage";

export const Route = createFileRoute("/skills")({
  component: SkillsPage,
});
