import type { Meta, StoryObj } from "@storybook/react";
import { JobsPageContent } from "./JobsPageContent";
import type { JobRow } from "@repo/models";

const mockJobs: JobRow[] = [
  {
    id: "job-001",
    title: "Pipeline 运行",
    status: "running",
    type: "pipeline_run",
    projectId: "proj-001",
    pipelineId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: new Date(Date.now() - 3000),
    finishedAt: null,
    createdAt: new Date(Date.now() - 5000),
    updatedAt: new Date(),
  },
  {
    id: "job-002",
    title: "代码分析",
    status: "done",
    type: "code_analysis",
    projectId: "proj-002",
    pipelineId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: new Date(Date.now() - 10000),
    finishedAt: new Date(Date.now() - 2000),
    createdAt: new Date(Date.now() - 12000),
    updatedAt: new Date(),
  },
  {
    id: "job-003",
    title: "技能执行",
    status: "failed",
    type: "skill_execution",
    projectId: null,
    pipelineId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: new Date(Date.now() - 8000),
    finishedAt: new Date(Date.now() - 4000),
    createdAt: new Date(Date.now() - 9000),
    updatedAt: new Date(),
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
