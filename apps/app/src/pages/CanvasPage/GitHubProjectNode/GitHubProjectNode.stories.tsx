import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { HarnessCanvasStoreProvider } from "../_store";
import { GitHubProjectNode } from "./GitHubProjectNode";

const meta: Meta<typeof GitHubProjectNode> = {
  title: "HarnessCanvas/GitHubProjectNode",
  component: GitHubProjectNode,
  tags: ["autodocs"],
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
  parameters: {
    docs: {
      description: {
        component:
          "Canvas node card for a GitHub project object. Stories cover configured repository, selected, and empty-repo setup states.",
      },
    },
  },
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
  parameters: {
    docs: {
      description: {
        story: "GitHub project node with owner, repository, branch, and description populated.",
      },
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
  parameters: {
    docs: {
      description: {
        story: "Selected GitHub project node state.",
      },
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
  parameters: {
    docs: {
      description: {
        story: "New GitHub project node before a repository has been selected or connected.",
      },
    },
  },
};
