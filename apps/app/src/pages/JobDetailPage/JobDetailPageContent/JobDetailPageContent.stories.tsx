import type { Meta, StoryObj } from "@storybook/react";
import { JobDetailPageContent } from "./JobDetailPageContent";
import type { JobRow } from "@repo/models";

const mockJob: JobRow = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  projectId: null,
  pipelineId: "p-1",
  logs: [],
  result: null,
  error: null,
  startedAt: new Date(Date.now() - 5000),
  finishedAt: new Date(),
  createdAt: new Date(Date.now() - 10000),
  updatedAt: new Date(),
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
