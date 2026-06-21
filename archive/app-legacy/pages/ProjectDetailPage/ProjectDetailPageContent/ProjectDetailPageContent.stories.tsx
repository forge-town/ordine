import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Pages/ProjectDetailPage/ProjectDetailPageContent",
  parameters: {
    docs: {
      description: {
        component:
          "This component uses useParams() and requires a live TanStack Router context. View it in the running app at /projects/:projectId.",
      },
    },
  },
  render: () => (
    <div className="p-8 text-sm text-muted-foreground">
      This component uses useParams() and requires a live TanStack Router context to render. Please
      view it in the running app.
    </div>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
