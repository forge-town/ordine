import type { Meta, StoryObj } from "@storybook/react";
import { PageLoadingState } from "./PageLoadingState";

const meta: Meta<typeof PageLoadingState> = {
  title: "Components/PageLoadingState",
  component: PageLoadingState,
};

export default meta;

type Story = StoryObj<typeof PageLoadingState>;

export const List: Story = {
  args: {
    title: "Loading data",
    variant: "list",
  },
};

export const Grid: Story = {
  args: {
    description: "Fetching dashboard cards",
    title: "Loading dashboard",
    variant: "grid",
  },
};

export const Detail: Story = {
  args: {
    description: "Preparing detail view",
    title: "Loading detail",
    variant: "detail",
  },
};
