import type { Meta, StoryObj } from "@storybook/react";
import { CanvasPage } from "./CanvasPage";

const meta: Meta<typeof CanvasPage> = {
  title: "Pages/CanvasPage",
  component: CanvasPage,
};
export default meta;
type Story = StoryObj<typeof CanvasPage>;
export const Default: Story = { args: {} };
