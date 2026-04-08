import type { Meta, StoryObj } from "@storybook/react";
import { SkillsPage } from "./SkillsPage";

const meta: Meta<typeof SkillsPage> = {
  title: "Pages/SkillsPage",
  component: SkillsPage,
};

export default meta;
type Story = StoryObj<typeof SkillsPage>;

export const Default: Story = {};
