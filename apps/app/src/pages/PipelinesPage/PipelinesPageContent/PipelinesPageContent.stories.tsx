import type { Meta, StoryObj } from "@storybook/react";
import { PipelinesPageContent } from "./PipelinesPageContent";
import { PipelinesPageStoreProvider } from "../_store";

const meta: Meta<typeof PipelinesPageContent> = {
  title: "Pages/PipelinesPage/PipelinesPageContent",
  component: PipelinesPageContent,
  decorators: [
    (Story) => (
      <PipelinesPageStoreProvider>
        <Story />
      </PipelinesPageStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof PipelinesPageContent>;

export const Default: Story = {};
