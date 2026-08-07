import type { Meta, StoryObj } from "@storybook/react";
import { LocalAgentsPage } from "./LocalAgentsPage";

const meta: Meta<typeof LocalAgentsPage> = {
  title: "Pages/LocalAgentsPage",
  component: LocalAgentsPage,
};

export default meta;
type Story = StoryObj<typeof LocalAgentsPage>;

export const Default: Story = {};
