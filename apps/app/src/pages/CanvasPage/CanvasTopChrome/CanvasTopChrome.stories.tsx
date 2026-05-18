import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { CanvasTopChrome } from "./CanvasTopChrome";

const meta: Meta<typeof CanvasTopChrome> = {
  title: "CanvasPage/CanvasTopChrome",
  component: CanvasTopChrome,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider
        pipeline={{
          id: "story-pipeline",
          name: "Aligned canvas pipeline",
          nodes: [],
          edges: [],
        }}
      >
        <div className="relative h-40 w-full bg-slate-50">
          <Story />
        </div>
      </HarnessCanvasStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CanvasTopChrome>;

export const Default: Story = {};
