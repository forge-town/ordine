import type { Meta, StoryObj } from "@storybook/react";
import { ProjectCard } from "./ProjectCard";
import type { GithubProject } from "@repo/schemas";

const mockProject = {
  id: "proj-001",
  name: "acme/ordine",
  owner: "acme",
  repo: "ordine",
  branch: "main",
  description: "用于管理工作流的平台",
  githubUrl: "https://github.com/acme/ordine",
  isPrivate: false,
  meta: { createdAt: new Date(), updatedAt: new Date() },
} as unknown as GithubProject;

const meta: Meta<typeof ProjectCard> = {
  title: "Pages/ProjectsPage/ProjectCard",
  component: ProjectCard,
  args: { onClick: () => {}, onDelete: () => {} },
};

export default meta;
type Story = StoryObj<typeof ProjectCard>;

export const Default: Story = { args: { project: mockProject } };
