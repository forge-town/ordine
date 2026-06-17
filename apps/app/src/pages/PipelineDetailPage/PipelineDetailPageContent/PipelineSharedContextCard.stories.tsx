import type { Meta, StoryObj } from "@storybook/react";
import { PipelineSharedContextCard } from "./PipelineSharedContextCard";

const meta: Meta<typeof PipelineSharedContextCard> = {
  title: "Pipelines/PipelineSharedContextCard",
  component: PipelineSharedContextCard,
};

export default meta;
type Story = StoryObj<typeof PipelineSharedContextCard>;

export const Empty: Story = {
  args: { value: "", onSave: () => {} },
};

export const Filled: Story = {
  args: {
    value: "All operations should keep a concise, professional tone and cite their sources.",
    onSave: () => {},
  },
};

export const Saving: Story = {
  args: { value: "Draft shared context being saved…", isSaving: true, onSave: () => {} },
};
