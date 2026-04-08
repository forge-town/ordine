import type { Meta, StoryObj } from "@storybook/react";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { JobEntity } from "@/models/daos/jobsDao";

const mockJob: JobEntity = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  workId: null,
  projectId: null,
  pipelineId: "p-1",
  logs: [],
  result: undefined,
  error: null,
  startedAt: Date.now() - 5000,
  finishedAt: Date.now(),
  createdAt: Date.now() - 10000,
  updatedAt: Date.now(),
};

const meta: Meta<typeof JobDetailPageContent> = {
  title: "JobDetailPage/JobDetailPageContent",
  component: JobDetailPageContent,
  args: { job: mockJob },
};
export default meta;
type Story = StoryObj<typeof JobDetailPageContent>;
export const Default: Story = { args: {} };
export const NullJob: Story = { args: { job: null } };
export const Running: Story = {
  args: { job: { ...mockJob, status: "running" } },
};
