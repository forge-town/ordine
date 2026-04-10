import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { HarnessCanvasHeader } from "./HarnessCanvasHeader";

const meta: Meta<typeof HarnessCanvasHeader> = {
  title: "CanvasPage/HarnessCanvasHeader",
  component: HarnessCanvasHeader,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof HarnessCanvasHeader>;
export const Default: Story = { args: {} };
