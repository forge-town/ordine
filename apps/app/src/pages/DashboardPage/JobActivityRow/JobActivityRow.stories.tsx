import type { Meta, StoryObj } from "@storybook/react";
import { JobActivityRow } from "./JobActivityRow";
import type { JobEntity } from "@repo/models";

const baseJob: JobEntity = {
  id: "job-1",
  title: "运行 Pipeline: 代码分析",
  type: "pipeline_run",
  status: "done",
  projectId: null,
  pipelineId: "pipeline-1",
  logs: [],
  result: null,
  error: null,
  startedAt: null,
  finishedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const meta: Meta<typeof JobActivityRow> = {
  title: "DashboardPage/JobActivityRow",
  component: JobActivityRow,
  args: { job: baseJob },
};
export default meta;
type Story = StoryObj<typeof JobActivityRow>;
export const Done: Story = { args: {} };
export const Running: Story = {
  args: { job: { ...baseJob, status: "running" } },
};
export const Failed: Story = {
  args: { job: { ...baseJob, status: "failed" } },
};
