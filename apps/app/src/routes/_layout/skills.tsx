import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@repo/views/SkillsPage";

export const Route = createFileRoute("/_layout/skills")({
  head: () => ({
    meta: [{ title: "Skills | Ordine" }],
  }),
  component: SkillsPage,
});
