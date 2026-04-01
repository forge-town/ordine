import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../../_store";
import { GitHubProjectNode } from "./GitHubProjectNode";

const meta: Meta<typeof GitHubProjectNode> = {
  title: "HarnessCanvas/GitHubProjectNode",
  component: GitHubProjectNode,
  decorators: [
    (Story) => (
      <HarnessCanvasStoreProvider>
        <ReactFlowProvider>
          <div style={{ padding: 24 }}>
            <Story />
          </div>
        </ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof GitHubProjectNode>;

export const Default: Story = {
  args: {
    data: {
      nodeType: "github-project",
      label: "ordine",
      owner: "amin",
      repo: "ordine",
      branch: "main",
      description: "主项目仓库",
    },
  },
};

export const Selected: Story = {
  args: {
    selected: true,
    data: {
      nodeType: "github-project",
      label: "react",
      owner: "facebook",
      repo: "react",
      branch: "main",
    },
  },
};

export const NoRepo: Story = {
  args: {
    data: {
      nodeType: "github-project",
      label: "新项目",
      owner: "",
      repo: "",
    },
  },
};
