import type { Meta, StoryObj } from "@storybook/react";
import { Field } from "./Field";

const meta: Meta<typeof Field> = {
  title: "Pages/SettingsPage/components/Field",
  component: Field,
};

export default meta;

type Story = StoryObj<typeof Field>;

export const Default: Story = {
  args: {
    label: "Name",
    children: <input className="border rounded px-2 py-1 text-sm" />,
  },
};
