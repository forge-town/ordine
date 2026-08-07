import type { Meta, StoryObj } from "@storybook/react";
import { UsagePage } from "./UsagePage";

const meta: Meta<typeof UsagePage> = {
  title: "Pages/UsagePage",
  component: UsagePage,
};

export default meta;
type Story = StoryObj<typeof UsagePage>;

export const Default: Story = {};
