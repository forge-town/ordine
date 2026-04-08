import type { Meta, StoryObj } from "@storybook/react";
import { JobsPage } from "./JobsPage";

const meta: Meta<typeof JobsPage> = {
  title: "Pages/JobsPage",
  component: JobsPage,
};

export default meta;
type Story = StoryObj<typeof JobsPage>;

export const Default: Story = {};
