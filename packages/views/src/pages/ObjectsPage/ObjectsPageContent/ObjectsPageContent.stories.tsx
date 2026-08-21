import type { Meta, StoryObj } from "@storybook/react";
import { ObjectsPageContent } from "./ObjectsPageContent";

const meta: Meta<typeof ObjectsPageContent> = {
  title: "Pages/ObjectsPage/ObjectsPageContent",
  component: ObjectsPageContent,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Develop-owned object catalog surface. The story covers built-in file/folder entries and plugin-provided object type cards without introducing Alan state.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ObjectsPageContent>;

export const Default: Story = {};
