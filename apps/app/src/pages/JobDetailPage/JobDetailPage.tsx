import { AppLayout } from "@/components/AppLayout";
import { JobDetailPageContent } from "./JobDetailPageContent";
import { Route } from "@/routes/jobs.$jobId";
import type { JobEntity } from "@/models/daos/jobsDao";

export const JobDetailPage = () => {
  const job = Route.useLoaderData() as JobEntity | null;

  return (
    <AppLayout>
      <JobDetailPageContent job={job} />
    </AppLayout>
  );
};
