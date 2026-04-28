import type { Meta, StoryObj } from "@storybook/react";
import { RulesPageContent } from "./RulesPageContent";
import { RulesPageStoreProvider } from "../_store";

const meta: Meta<typeof RulesPageContent> = {
  title: "Pages/RulesPage/RulesPageContent",
  component: RulesPageContent,
  decorators: [
    (Story) => (
      <RulesPageStoreProvider>
        <Story />
      </RulesPageStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof RulesPageContent>;

export const Default: Story = {
  args: {
    rules: [],
  },
};
