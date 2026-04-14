import type { Meta, StoryObj } from "@storybook/react";
import { WorkRow } from "./WorkRow";
import type { WorkEntity } from "@repo/models";

const mockWork = {
  id: "work-001",
  pipelineName: "CI Pipeline",
  status: "success",
  object: { type: "file", path: "/src/main.ts" },
  createdAt: Date.now(),
  updatedAt: Date.now(),
} as unknown as WorkEntity;

const meta: Meta<typeof WorkRow> = {
  title: "Pages/ProjectDetailPage/WorkRow",
  component: WorkRow,
};

export default meta;
type Story = StoryObj<typeof WorkRow>;

export const Default: Story = { args: { work: mockWork } };

export const Running: Story = {
  args: { work: { ...mockWork, status: "running" } },
};

export const Failed: Story = {
  args: { work: { ...mockWork, status: "failed" } },
};
