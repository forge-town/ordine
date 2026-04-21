import type { Meta, StoryObj } from "@storybook/react";
import { BestPracticesPage } from "./BestPracticesPage";

const meta: Meta<typeof BestPracticesPage> = {
  title: "Pages/BestPracticesPage",
  component: BestPracticesPage,
};

export default meta;
type Story = StoryObj<typeof BestPracticesPage>;

export const Default: Story = {
  args: {},
};
