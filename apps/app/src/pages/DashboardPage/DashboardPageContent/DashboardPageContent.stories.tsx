import type { Meta, StoryObj } from "@storybook/react";
import { DashboardPageContent } from "./DashboardPageContent";
import type { JobEntity } from "@/models/daos/jobsDao";

const meta: Meta<typeof DashboardPageContent> = {
  title: "DashboardPage/DashboardPageContent",
  component: DashboardPageContent,
  args: {
    pipelines: [],
    projects: [],
    jobs: [],
  },
};
export default meta;
type Story = StoryObj<typeof DashboardPageContent>;
export const Default: Story = { args: {} };
export const WithJobs: Story = {
  args: {
    jobs: [
      {
        id: "job-1",
        title: "运行 Pipeline",
        type: "pipeline_run",
        status: "running",
        workId: null,
        projectId: null,
        pipelineId: "p-1",
        logs: [],
        result: undefined,
        error: null,
        startedAt: null,
        finishedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      } satisfies JobEntity,
    ],
  },
};
