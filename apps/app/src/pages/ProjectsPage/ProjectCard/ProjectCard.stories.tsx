import type { Meta, StoryObj } from "@storybook/react";
import { ProjectCard } from "./ProjectCard";
import type { GithubProjectEntity } from "@/models/daos/githubProjectsDao";

const mockProject = {
  id: "proj-001",
  name: "acme/ordine",
  owner: "acme",
  repo: "ordine",
  branch: "main",
  description: "用于管理工作流的平台",
  githubUrl: "https://github.com/acme/ordine",
  isPrivate: false,
  updatedAt: Date.now(),
  createdAt: Date.now(),
} as unknown as GithubProjectEntity;

const meta: Meta<typeof ProjectCard> = {
  title: "Pages/ProjectsPage/ProjectCard",
  component: ProjectCard,
  args: { onClick: () => {}, onDelete: () => {} },
};

export default meta;
type Story = StoryObj<typeof ProjectCard>;

export const Default: Story = { args: { project: mockProject } };
