import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { CanvasFloatingMenu } from "./CanvasFloatingMenu";

const meta: Meta<typeof CanvasFloatingMenu> = {
  title: "CanvasPage/CanvasFloatingMenu",
  component: CanvasFloatingMenu,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof CanvasFloatingMenu>;
export const Default: Story = { args: {} };
