import type { Meta, StoryObj } from "@storybook/react";
import { ConnectorsPage } from "./ConnectorsPage";

const meta: Meta<typeof ConnectorsPage> = {
  title: "Pages/ConnectorsPage",
  component: ConnectorsPage,
};

export default meta;
type Story = StoryObj<typeof ConnectorsPage>;

export const Default: Story = {};
