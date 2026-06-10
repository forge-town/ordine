import type { Meta, StoryObj } from "@storybook/react";
import { JobRow } from "./JobRow";
import type { Job } from "@repo/schemas";

const baseJob: Job = {
  id: "job-001",
  title: "构建并测试 Pipeline",
  status: "running",
  type: "pipeline_run",
  parentJobId: null,
  pipelineId: "pipeline-1",
  projectId: null,
  totalTokens: 51000,
  totalCost: "0.18",
  nodeStatuses: { input: "done", research: "running", output: "idle" },
  error: null,
  startedAt: new Date(Date.now() - 5000),
  finishedAt: null,
  meta: { createdAt: new Date(Date.now() - 10_000), updatedAt: new Date() },
};

const meta: Meta<typeof JobRow> = {
  title: "Pages/JobsPage/JobRow",
  component: JobRow,
};

export default meta;
type Story = StoryObj<typeof JobRow>;

export const Default: Story = {
  args: { job: baseJob, pipelineName: "Lead Research Brief" },
};

export const Done: Story = {
  args: {
    job: { ...baseJob, status: "done", finishedAt: new Date() },
    pipelineName: "Lead Research Brief",
  },
};

export const Failed: Story = {
  args: {
    job: { ...baseJob, status: "failed", finishedAt: new Date() },
    pipelineName: "Lead Research Brief",
  },
};

export const Queued: Story = {
  args: {
    job: { ...baseJob, status: "queued", startedAt: null },
    pipelineName: "Lead Research Brief",
  },
};
