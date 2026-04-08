import type { Meta, StoryObj } from "@storybook/react";
import { PipelinesPage } from "./PipelinesPage";

const meta: Meta<typeof PipelinesPage> = {
  title: "Pages/PipelinesPage",
  component: PipelinesPage,
};

export default meta;
type Story = StoryObj<typeof PipelinesPage>;

export const Default: Story = {};
