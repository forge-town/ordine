import { useLoaderData } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { WorkDetailPageContent } from "./WorkDetailPageContent";
import type { WorkEntity } from "@/models/daos/worksDao";

export const WorkDetailPage = () => {
  const work = useLoaderData({ from: "/works/$workId" }) as WorkEntity | null;
  return (
    <AppLayout>
      <WorkDetailPageContent work={work} />
    </AppLayout>
  );
};
