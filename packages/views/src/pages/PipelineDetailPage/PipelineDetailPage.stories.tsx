import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Pages/PipelineDetailPage",
  parameters: {
    docs: {
      description: {
        component:
          "This page reads pipelineId via props and uses Refine data hooks. View it in the running app at /pipelines/:pipelineId.",
      },
    },
  },
  render: () => (
    <div className="p-8 text-sm text-muted-foreground">
      This page component requires a live TanStack Router + Refine context to render. Please view it
      in the running app.
    </div>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
