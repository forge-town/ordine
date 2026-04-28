import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Pages/ProjectWorkspacePage",
  parameters: {
    docs: {
      description: {
        component:
          "This page has a circular dependency with its route file and requires a live TanStack Router context. View it in the running app at /projects/:projectId/workspace.",
      },
    },
  },
  render: () => (
    <div className="p-8 text-sm text-muted-foreground">
      This page component has a circular route dependency and requires a live TanStack Router
      context to render. Please view it in the running app.
    </div>
  ),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {};
