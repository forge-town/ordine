import type { Meta, StoryObj } from "@storybook/react";
import { ProjectMeta } from "./ProjectMeta";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";

const mockProject = {
  id: "proj-001",
  name: "ordine",
  owner: "acme",
  repo: "ordine",
  branch: "main",
  description: "用于管理工作流的平台",
  githubUrl: "https://github.com/acme/ordine",
} as unknown as GithubProjectEntity;

const meta: Meta<typeof ProjectMeta> = {
  title: "Pages/ProjectDetailPage/ProjectMeta",
  component: ProjectMeta,
};

export default meta;
type Story = StoryObj<typeof ProjectMeta>;

export const Default: Story = { args: { project: mockProject } };
