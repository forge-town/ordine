import type { Meta, StoryObj } from "@storybook/react";
import { Info, Tag } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

const meta: Meta<typeof SectionHeader> = {
  title: "Pages/OperationDetailPage/SectionHeader",
  component: SectionHeader,
};

export default meta;
type Story = StoryObj<typeof SectionHeader>;

export const Default: Story = {
  args: { icon: Info, label: "基本信息" },
};

export const Tag_: Story = {
  args: { icon: Tag, label: "元数据" },
};
