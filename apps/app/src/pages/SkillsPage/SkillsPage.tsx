import { AppLayout } from "@/components/AppLayout";
import { SkillsPageContent } from "./SkillsPageContent";
import { Route } from "@/routes/skills";

export const SkillsPage = () => {
  const skills = Route.useLoaderData();

  return (
    <AppLayout>
      <SkillsPageContent skills={skills} />
    </AppLayout>
  );
};
