import type { Meta, StoryObj } from "@storybook/react";
import { MetaRow } from "./MetaRow";

const meta: Meta<typeof MetaRow> = {
  title: "JobDetailPage/MetaRow",
  component: MetaRow,
  args: { label: "类型", value: "Pipeline 执行" },
};
export default meta;
type Story = StoryObj<typeof MetaRow>;
export const Default: Story = { args: {} };
export const Mono: Story = {
  args: { label: "ID", value: "job-abc-123", mono: true },
};
export const Empty: Story = { args: { value: null } };
