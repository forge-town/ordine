import type { Meta, StoryObj } from "@storybook/react";
import { OperationsPageContent } from "./OperationsPageContent";
import { OperationsPageStoreProvider } from "../_store";

const meta: Meta<typeof OperationsPageContent> = {
  title: "Pages/OperationsPage/OperationsPageContent",
  component: OperationsPageContent,
  decorators: [
    (Story) => (
      <OperationsPageStoreProvider>
        <Story />
      </OperationsPageStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OperationsPageContent>;

export const Default: Story = {
  args: { initialOperations: [] },
};
