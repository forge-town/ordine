import type { Meta, StoryObj } from "@storybook/react";
import { RuleForm } from "./RuleForm";

const meta: Meta<typeof RuleForm> = {
  title: "Pages/RulesPage/RuleForm",
  component: RuleForm,
};

export default meta;

type Story = StoryObj<typeof RuleForm>;

export const Default: Story = {
  args: {
    onSave: async () => {},
    onCancel: () => {},
  },
};
