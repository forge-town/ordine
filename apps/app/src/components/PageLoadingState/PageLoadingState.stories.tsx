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
    variant: "list",
  },
};

export const Grid: Story = {
  args: {
    variant: "grid",
  },
};

export const Detail: Story = {
  args: {
    variant: "detail",
  },
};
