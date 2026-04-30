import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasEmptyState } from "./CanvasEmptyState";

const meta: Meta<typeof CanvasEmptyState> = {
  title: "CanvasPage/CanvasEmptyState",
  component: CanvasEmptyState,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <div className="relative h-96 w-full bg-slate-50">
          <Story />
        </div>
      </HarnessCanvasStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Empty-canvas entry card shown when the pipeline has no nodes. It gives first-time users a quick-add action and a right-click creation hint without blocking canvas interactions outside the card.",
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
        story: "Centered first-run card with the same quick-add action used by the toolbar.",
      },
    },
  },
};
