import type { Meta, StoryObj } from "@storybook/react";
import { JobRow } from "./JobRow";
import type { JobRow as JobRowData } from "@repo/models";

const baseJob: JobRowData = {
  id: "job-001",
  title: "构建并测试 Pipeline",
  status: "running",
  type: "pipeline_run",
  projectId: "proj-001",
  pipelineId: null,
  logs: [],
  result: null,
  error: null,
  startedAt: new Date(Date.now() - 5000),
  finishedAt: null,
  createdAt: new Date(Date.now() - 10000),
  updatedAt: new Date(),
};

const meta: Meta<typeof JobRow> = {
  title: "Pages/JobsPage/JobRow",
  component: JobRow,
  args: {
    onClick: () => {},
    onDelete: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof JobRow>;

export const Default: Story = {
  args: { job: baseJob },
};

export const Done: Story = {
  args: {
    job: { ...baseJob, status: "done", finishedAt: new Date() },
  },
};

export const Failed: Story = {
  args: {
    job: { ...baseJob, status: "failed", finishedAt: new Date() },
  },
};

export const Queued: Story = {
  args: {
    job: { ...baseJob, status: "queued", startedAt: null },
  },
};
