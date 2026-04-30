import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { CanvasPageContent } from "./CanvasPageContent";

const meta: Meta<typeof CanvasPageContent> = {
  title: "CanvasPage/CanvasPageContent",
  component: CanvasPageContent,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <HarnessCanvasStoreProvider pipeline={null}>
          <ReactFlowProvider>
            <Story />
          </ReactFlowProvider>
        </HarnessCanvasStoreProvider>
      </Refine>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Top-level Canvas content wrapper that provides React Flow context and clips the workbench to the available viewport.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasPageContent>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Full Canvas content wrapper in its default empty state.",
      },
    },
  },
};
