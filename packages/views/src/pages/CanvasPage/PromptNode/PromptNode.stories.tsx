import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasPageStoreProvider } from "../_store";
import { PromptNode } from "./PromptNode";

const meta: Meta<typeof PromptNode> = {
  title: "CanvasPage/PromptNode",
  component: PromptNode,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <CanvasPageStoreProvider>
        <ReactFlowProvider>
          <div style={{ padding: 24 }}>
            <Story />
          </div>
        </ReactFlowProvider>
      </CanvasPageStoreProvider>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Canvas node card for free-text prompt input. Provides inline text that flows into downstream operation nodes without requiring file or folder inputs.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PromptNode>;

export const Default: Story = {
  args: {
    id: "prompt-1",
    data: {
      nodeType: "prompt",
      label: "System Prompt",
      prompt: "Analyze the codebase and suggest improvements.",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Prompt node with label and prompt text populated.",
      },
    },
  },
};

export const Selected: Story = {
  args: {
    id: "prompt-2",
    selected: true,
    data: {
      nodeType: "prompt",
      label: "Review Instructions",
      prompt: "Review each file for security vulnerabilities.",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Selected prompt node state.",
      },
    },
  },
};

export const EmptyPrompt: Story = {
  args: {
    id: "prompt-3",
    data: {
      nodeType: "prompt",
      label: "New Prompt",
      prompt: "",
    },
  },
  parameters: {
    docs: {
      description: {
        story: "Prompt node with empty prompt showing placeholder text.",
      },
    },
  },
};
