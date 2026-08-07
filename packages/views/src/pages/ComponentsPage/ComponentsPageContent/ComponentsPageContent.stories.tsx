import type { Meta, StoryObj } from "@storybook/react";
import { ComponentsPageContent } from "./ComponentsPageContent";

const meta: Meta<typeof ComponentsPageContent> = {
  title: "Pages/ComponentsPage/ComponentsPageContent",
  component: ComponentsPageContent,
  decorators: [
    (Story) => (
      <div className="h-screen min-h-[640px] bg-background">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof ComponentsPageContent>;

export const Library: Story = {};
