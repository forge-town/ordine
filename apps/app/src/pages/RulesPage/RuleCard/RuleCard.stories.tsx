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
      checkScript: "grep -rn 'console.log' $INPUT_PATH && exit 1 || exit 0",
      scriptLanguage: "typescript",
      acceptedObjectTypes: ["file", "folder", "project"],
      enabled: true,
      tags: ["debug"],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    onDelete: () => {},
    onToggle: () => {},
    onNavigateToDetail: () => {},
    onNavigateToEdit: () => {},
  },
};
