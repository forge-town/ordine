import type { Meta, StoryObj } from "@storybook/react";
import { CanvasPageStoreProvider } from "../_store";
import { CanvasEmptyState } from "./CanvasEmptyState";

const meta: Meta<typeof CanvasEmptyState> = {
  title: "CanvasPage/CanvasEmptyState",
  component: CanvasEmptyState,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <CanvasPageStoreProvider pipeline={null}>
        <div className="relative h-96 w-full bg-slate-50">
          <Story />
        </div>
      </CanvasPageStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Centered empty-canvas entry state shown when the pipeline has no nodes. It gives first-time users the same quick-add action used by the canvas toolbar.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CanvasEmptyState>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Centered first-run empty state with the same quick-add action used by the toolbar.",
      },
    },
  },
};
