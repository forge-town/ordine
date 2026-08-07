import type { Meta, StoryObj } from "@storybook/react";
import { JobsPageContent } from "./JobsPageContent";
import { JobsPageStoreProvider } from "../_store";

const meta: Meta<typeof JobsPageContent> = {
  title: "Pages/JobsPage/JobsPageContent",
  component: JobsPageContent,
  decorators: [
    (Story) => (
      <JobsPageStoreProvider>
        <div className="h-screen min-h-[640px] bg-background">
          <Story />
        </div>
      </JobsPageStoreProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj<typeof JobsPageContent>;

export const Console: Story = {};
