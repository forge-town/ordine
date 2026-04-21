import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasPageContent } from "./CanvasPageContent";

const meta: Meta<typeof CanvasPageContent> = {
  title: "CanvasPage/CanvasPageContent",
  component: CanvasPageContent,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <ReactFlowProvider>
          <Story />
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CanvasPageContent>;
export const Default: Story = { args: {} };
