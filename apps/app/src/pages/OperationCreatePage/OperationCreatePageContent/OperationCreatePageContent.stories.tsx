import type { Meta, StoryObj } from "@storybook/react";
import { OperationCreatePageContent } from "./OperationCreatePageContent";
import { OperationCreatePageStoreProvider } from "../_store";

const meta: Meta<typeof OperationCreatePageContent> = {
  title: "Pages/OperationCreatePage/OperationCreatePageContent",
  component: OperationCreatePageContent,
  decorators: [
    (Story) => (
      <OperationCreatePageStoreProvider>
        <Story />
      </OperationCreatePageStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OperationCreatePageContent>;

export const Default: Story = {};
