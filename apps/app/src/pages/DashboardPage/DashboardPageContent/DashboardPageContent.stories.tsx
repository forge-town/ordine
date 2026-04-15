import type { Meta, StoryObj } from "@storybook/react";
import { DashboardPageContent } from "./DashboardPageContent";
import type { JobRow } from "@repo/models";

// Route.useLoaderData is mocked via Storybook parameters or decorators
const meta: Meta<typeof DashboardPageContent> = {
  title: "DashboardPage/DashboardPageContent",
  component: DashboardPageContent,
};
export default meta;
type Story = StoryObj<typeof DashboardPageContent>;

export const Default: Story = {};

export const WithJobs: Story = {
  decorators: [
    (Story) => {
      const { Route } = require("@/routes/index");
      const mockJob: JobRow = {
        id: "job-1",
        title: "运行 Pipeline",
        type: "pipeline_run",
        status: "running",
        projectId: null,
        pipelineId: "p-1",
        logs: [],
        result: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      Route.useLoaderData = () => ({ pipelines: [], projects: [], jobs: [mockJob] });
      return <Story />;
    },
  ],
};
