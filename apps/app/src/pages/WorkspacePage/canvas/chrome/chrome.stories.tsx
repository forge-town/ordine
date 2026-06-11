import type { Meta, StoryObj } from "@storybook/react";
import { ReactFlowProvider } from "@xyflow/react";
import { CanvasToolbar } from "./CanvasToolbar";
import { StateLegend } from "./StateLegend";
import { VersionMenu } from "./VersionMenu";

const meta: Meta = {
  title: "WorkspacePage/CanvasV2/Chrome",
  decorators: [
    (Story) => (
      <div className="flex h-64 items-start justify-center bg-background p-8">
        <Story />
      </div>
    ),
  ],
};

export default meta;

export const Legend: StoryObj = {
  render: () => <StateLegend />,
};

export const Toolbar: StoryObj = {
  render: () => (
    <ReactFlowProvider>
      <div className="relative h-40 w-80">
        <CanvasToolbar />
      </div>
    </ReactFlowProvider>
  ),
};

export const VersionClean: StoryObj = {
  render: () => (
    <VersionMenu
      dirty={false}
      runState="done"
      version={3}
      onOverwrite={() => {}}
      onSaveAsNew={() => {}}
    />
  ),
};

export const VersionDirty: StoryObj = {
  render: () => (
    <VersionMenu
      dirty
      runState="draft"
      version={3}
      onOverwrite={() => {}}
      onSaveAsNew={() => {}}
    />
  ),
};
