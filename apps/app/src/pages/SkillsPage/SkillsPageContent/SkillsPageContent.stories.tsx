import type { Meta, StoryObj } from "@storybook/react";
import { SkillsPageContent } from "./SkillsPageContent";

const meta: Meta<typeof SkillsPageContent> = {
  title: "Pages/SkillsPage/SkillsPageContent",
  component: SkillsPageContent,
};

export default meta;
type Story = StoryObj<typeof SkillsPageContent>;

export const Default: Story = {
  args: { skills: [] },
};
