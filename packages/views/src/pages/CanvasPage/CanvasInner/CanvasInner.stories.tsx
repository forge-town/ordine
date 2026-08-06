import { useEffect } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Refine } from "@refinedev/core";
import { ReactFlowProvider } from "@xyflow/react";
import { PlatformProvider, type PlatformCapabilities } from "../../../platform";
import { CanvasPageStoreProvider, useCanvasPageStore } from "../_store";
import { canvasStoryDataProvider } from "../storybookData";
import { CanvasInner } from "./CanvasInner";

interface CanvasInnerStoryProps {
  agentPanelOpen?: boolean;
}

const storyPlatform: PlatformCapabilities = {
  apiBaseUrl: "",
  downloadBlob: () => undefined,
  request: (input, init) => fetch(input, init),
};

const CanvasInnerStory = ({ agentPanelOpen = false }: CanvasInnerStoryProps) => {
  const store = useCanvasPageStore();

  useEffect(() => {
    store.setState((state) => ({
      agentPanel: { ...state.agentPanel, isOpen: agentPanelOpen },
    }));
  }, [agentPanelOpen, store]);

  return (
    <PlatformProvider value={storyPlatform}>
      <CanvasInner />
    </PlatformProvider>
  );
};

const meta: Meta<typeof CanvasInnerStory> = {
  title: "CanvasPage/CanvasInner",
  component: CanvasInnerStory,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <Refine dataProvider={canvasStoryDataProvider}>
        <CanvasPageStoreProvider pipeline={null}>
          <ReactFlowProvider>
            <Story />
          </ReactFlowProvider>
        </CanvasPageStoreProvider>
      </Refine>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Canvas shell that layers the title pill, floating save menu, toolbar, flow surface, empty state, quick add, status bar, context menus, inspection card, and run console.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof CanvasInnerStory>;
export const Default: Story = {
  args: { agentPanelOpen: false },
  parameters: {
    docs: {
      description: {
        story: "Default empty CanvasInner layout with the empty-state card and status bar visible.",
      },
    },
  },
};

export const IntegratedAgentPanel: Story = {
  args: { agentPanelOpen: true },
  parameters: {
    docs: {
      description: {
        story:
          "Alan-style dual-pane workspace with the Canvas and resizable AgentPanel rendered as siblings.",
      },
    },
  },
};
