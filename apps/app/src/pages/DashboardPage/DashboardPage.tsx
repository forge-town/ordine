import { AppLayout } from "@/components/AppLayout";
import { DashboardPageContent } from "./DashboardPageContent";
import { Route } from "@/routes/index";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";
import type { JobEntity } from "@/models/daos/jobsDao";
import type { WorkEntity } from "@/models/daos/worksDao";

export const DashboardPage = () => {
  const data = Route.useLoaderData() as {
    pipelines: PipelineEntity[];
    projects: GithubProjectEntity[];
    jobs: JobEntity[];
    works: WorkEntity[];
  };

  return (
    <AppLayout>
      <DashboardPageContent
        pipelines={data.pipelines}
        projects={data.projects}
        jobs={data.jobs}
        works={data.works}
      />
    </AppLayout>
  );
};
