import type { Meta, StoryObj } from "@storybook/react";
import { JobRow } from "./JobRow";
import type { JobEntity } from "@/models/daos/jobsDao";

const baseJob: JobEntity = {
  id: "job-001",
  title: "构建并测试 Pipeline",
  status: "running",
  type: "pipeline_run",
  projectId: "proj-001",
  startedAt: Date.now() - 5000,
  finishedAt: null,
  createdAt: Date.now() - 10000,
  updatedAt: Date.now(),
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
    job: { ...baseJob, status: "done", finishedAt: Date.now() },
  },
};

export const Failed: Story = {
  args: {
    job: { ...baseJob, status: "failed", finishedAt: Date.now() },
  },
};

export const Queued: Story = {
  args: {
    job: { ...baseJob, status: "queued", startedAt: null },
  },
};
