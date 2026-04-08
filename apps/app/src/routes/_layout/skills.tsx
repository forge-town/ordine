import { createFileRoute } from "@tanstack/react-router";
import { SkillsPage } from "@/pages/SkillsPage";
import { getSkills } from "@/services/skillsService";

export const Route = createFileRoute("/_layout/skills")({
  loader: async () => {
    return getSkills();
  },
  component: SkillsPage,
});
