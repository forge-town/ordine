import { useLoaderData } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { WorksPageContent } from "./WorksPageContent";
import type { WorkEntity } from "@/models/daos/worksDao";

export const WorksPage = () => {
  const works = useLoaderData({ from: "/works" }) as WorkEntity[];
  return (
    <AppLayout>
      <WorksPageContent works={works} />
    </AppLayout>
  );
};
