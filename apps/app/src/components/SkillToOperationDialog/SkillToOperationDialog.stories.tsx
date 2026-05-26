import type { Meta, StoryObj } from "@storybook/react";
import { SkillToOperationDialog } from "./SkillToOperationDialog";

const meta: Meta<typeof SkillToOperationDialog> = {
  title: "Components/SkillToOperationDialog",
  component: SkillToOperationDialog,
  args: {
    onClose: () => {},
  },
};

export default meta;
type Story = StoryObj<typeof SkillToOperationDialog>;

export const Default: Story = {
  args: {
    open: true,
    skillId: "skill-003",
  },
};

export const Loading: Story = {
  args: {
    open: true,
    skillId: "skill-003",
  },
  parameters: {
    mockData: {
      isLoading: true,
    },
  },
};

export const Closed: Story = {
  args: {
    open: false,
    skillId: null,
  },
};
