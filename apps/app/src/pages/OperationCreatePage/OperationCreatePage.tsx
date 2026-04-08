import { AppLayout } from "@/components/AppLayout";
import { OperationCreatePageContent } from "./OperationCreatePageContent";
import { Route } from "@/routes/operations.new";
import type { SkillEntity } from "@/models/daos/skillsDao";

export const OperationCreatePage = () => {
  const skills = Route.useLoaderData() as SkillEntity[];

  return (
    <AppLayout>
      <OperationCreatePageContent skills={skills} />
    </AppLayout>
  );
};
