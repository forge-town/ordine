import type { Meta, StoryObj } from "@storybook/react";
import { Field } from "./Field";

const meta: Meta<typeof Field> = {
  title: "CanvasPage/Field",
  component: Field,
  args: { label: "示例字段" },
};
export default meta;
type Story = StoryObj<typeof Field>;
export const Default: Story = { args: { children: <span>值</span> } };
