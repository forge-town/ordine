import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "./_store";
import { CanvasPageContent } from "./CanvasPageContent";

const meta: Meta<typeof CanvasPageContent> = {
  title: "Pages/CanvasPage",
  component: CanvasPageContent,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider>
        <div style={{ width: "100vw", height: "100vh" }}>
          <Story />
        </div>
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CanvasPageContent>;
export const Default: Story = {};
