import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { QuickAddButton } from "./QuickAddButton";

const meta: Meta<typeof QuickAddButton> = {
  title: "CanvasPage/QuickAddButton",
  component: QuickAddButton,
  args: { nodeId: "node-1", nodeType: "code-file" },
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof QuickAddButton>;
export const Default: Story = { args: {} };
