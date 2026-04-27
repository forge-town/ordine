import type { Meta, StoryObj } from "@storybook/react";
import { JobsPageContent } from "./JobsPageContent";
import type { Job } from "@repo/schemas";

const mockJobs: Job[] = [
  {
    id: "job-001",
    title: "Pipeline 运行",
    status: "running",
    type: "pipeline_run",
    parentJobId: null,
    error: null,
    startedAt: new Date(Date.now() - 3000),
    finishedAt: null,
    meta: { createdAt: new Date(Date.now() - 5000), updatedAt: new Date() },
  },
  {
    id: "job-002",
    title: "蒸馏运行",
    status: "done",
    type: "distillation_run",
    parentJobId: null,
    error: null,
    startedAt: new Date(Date.now() - 10000),
    finishedAt: new Date(Date.now() - 2000),
    meta: { createdAt: new Date(Date.now() - 12000), updatedAt: new Date() },
  },
  {
    id: "job-003",
    title: "精炼运行",
    status: "failed",
    type: "refinement_run",
    parentJobId: null,
    error: null,
    startedAt: new Date(Date.now() - 8000),
    finishedAt: new Date(Date.now() - 4000),
    meta: { createdAt: new Date(Date.now() - 9000), updatedAt: new Date() },
  },
];

const meta: Meta<typeof JobsPageContent> = {
  title: "Pages/JobsPage/JobsPageContent",
  component: JobsPageContent,
};

export default meta;
type Story = StoryObj<typeof JobsPageContent>;

export const Default: Story = {
  args: { jobs: mockJobs },
};

export const Empty: Story = {
  args: { jobs: [] },
};
