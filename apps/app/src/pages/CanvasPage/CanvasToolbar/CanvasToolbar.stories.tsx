import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasToolbar } from "./CanvasToolbar";

const meta: Meta<typeof CanvasToolbar> = {
  title: "CanvasPage/CanvasToolbar",
  component: CanvasToolbar,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Compact canvas action bar for zoom, fit view, layout, history, quick add, deletion, and test-run controls.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasToolbar>;
export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Default toolbar state with no selected node and no saved pipeline id.",
      },
    },
  },
};
