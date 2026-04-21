import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasToolbar } from "./CanvasToolbar";

const meta: Meta<typeof CanvasToolbar> = {
  title: "CanvasPage/CanvasToolbar",
  component: CanvasToolbar,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CanvasToolbar>;
export const Default: Story = { args: {} };
