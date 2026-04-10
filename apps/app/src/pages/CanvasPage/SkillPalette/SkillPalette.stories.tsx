import type { Meta, StoryObj } from "@storybook/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { SkillPalette } from "./SkillPalette";

const meta: Meta<typeof SkillPalette> = {
  title: "CanvasPage/SkillPalette",
  component: SkillPalette,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider pipeline={null}>
        <Story />
      </HarnessCanvasStoreProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof SkillPalette>;
export const Default: Story = { args: {} };
