import type { Meta, StoryObj } from "@storybook/react";
import { DashboardPageContent } from "./DashboardPageContent";
import type { Job } from "@repo/schemas";

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
      const mockJob: Job = {
        id: "job-1",
        title: "运行 Pipeline",
        type: "pipeline_run",
        status: "running",
        parentJobId: null,
        error: null,
        startedAt: null,
        finishedAt: null,
        meta: { createdAt: new Date(), updatedAt: new Date() },
      };
      Route.useLoaderData = () => ({ pipelines: [], projects: [], jobs: [mockJob] });
      return <Story />;
    },
  ],
};
