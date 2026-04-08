import { AppLayout } from "@/components/AppLayout";
import { JobsPageContent } from "./JobsPageContent";
import { Route } from "@/routes/jobs.index";
import type { JobEntity } from "@/models/daos/jobsDao";

export const JobsPage = () => {
  const jobs = Route.useLoaderData() as JobEntity[];

  return (
    <AppLayout>
      <JobsPageContent jobs={jobs} />
    </AppLayout>
  );
};
