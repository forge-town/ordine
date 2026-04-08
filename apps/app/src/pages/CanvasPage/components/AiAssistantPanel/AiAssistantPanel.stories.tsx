import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { AiAssistantPanel } from "./AiAssistantPanel";

const meta: Meta<typeof AiAssistantPanel> = {
  title: "CanvasPage/AiAssistantPanel",
  component: AiAssistantPanel,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof AiAssistantPanel>;
export const Default: Story = { args: {} };
