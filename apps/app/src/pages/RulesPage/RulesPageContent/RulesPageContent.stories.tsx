import type { Meta, StoryObj } from "@storybook/react";
import { RulesPageContent } from "./RulesPageContent";

const meta: Meta<typeof RulesPageContent> = {
  title: "Pages/RulesPage/RulesPageContent",
  component: RulesPageContent,
};

export default meta;

type Story = StoryObj<typeof RulesPageContent>;

export const Default: Story = {
  args: {
    rules: [],
  },
};
