import type { Meta, StoryObj } from "@storybook/react";
import { JobsPageContent } from "./JobsPageContent";
import type { JobEntity } from "@/models/daos/jobsDao";

const mockJobs: JobEntity[] = [
  {
    id: "job-001",
    title: "Pipeline 运行",
    status: "running",
    type: "pipeline_run",
    projectId: "proj-001",
    pipelineId: null,
    workId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: Date.now() - 3000,
    finishedAt: null,
    createdAt: Date.now() - 5000,
    updatedAt: Date.now(),
  },
  {
    id: "job-002",
    title: "代码分析",
    status: "done",
    type: "code_analysis",
    projectId: "proj-002",
    pipelineId: null,
    workId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: Date.now() - 10000,
    finishedAt: Date.now() - 2000,
    createdAt: Date.now() - 12000,
    updatedAt: Date.now(),
  },
  {
    id: "job-003",
    title: "技能执行",
    status: "failed",
    type: "skill_execution",
    projectId: null,
    pipelineId: null,
    workId: null,
    logs: [],
    result: null,
    error: null,
    startedAt: Date.now() - 8000,
    finishedAt: Date.now() - 4000,
    createdAt: Date.now() - 9000,
    updatedAt: Date.now(),
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
