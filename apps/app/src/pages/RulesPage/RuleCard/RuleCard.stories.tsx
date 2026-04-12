import type { Meta, StoryObj } from "@storybook/react";
import { RuleCard } from "./RuleCard";

const meta: Meta<typeof RuleCard> = {
  title: "Pages/RulesPage/RuleCard",
  component: RuleCard,
};

export default meta;

type Story = StoryObj<typeof RuleCard>;

export const Default: Story = {
  args: {
    rule: {
      id: "rule-1",
      name: "No console.log",
      description: "禁止使用 console.log",
      category: "lint",
      severity: "warning",
      pattern: "console\\.log",
      enabled: true,
      tags: ["debug"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    onDelete: () => {},
    onToggle: () => {},
    onNavigateToDetail: () => {},
    onNavigateToEdit: () => {},
  },
};
