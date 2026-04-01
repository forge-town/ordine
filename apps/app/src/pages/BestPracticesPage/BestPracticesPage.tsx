import { AppLayout } from "@/components/AppLayout";
import { BestPracticesPageContent } from "./BestPracticesPageContent";
import { Route } from "@/routes/best-practices";
import type { BestPracticeEntity } from "@/models/daos/bestPracticesDao";

export const BestPracticesPage = () => {
  const practices = Route.useLoaderData() as BestPracticeEntity[];

  return (
    <AppLayout>
      <BestPracticesPageContent practices={practices} />
    </AppLayout>
  );
};
