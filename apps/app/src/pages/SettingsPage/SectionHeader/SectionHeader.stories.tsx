import type { Meta, StoryObj } from "@storybook/react";
import { SectionHeader } from "./SectionHeader";

const meta: Meta<typeof SectionHeader> = {
  title: "Pages/SettingsPage/components/SectionHeader",
  component: SectionHeader,
};

export default meta;

type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: {
    title: "个人信息",
    description: "管理你的账户名称和联系信息",
  },
};
