import type { Meta, StoryObj } from "@storybook/react";
import {
  Box,
  CircleCheck,
  CircleX,
  Clock,
  GitBranch,
  LoaderCircle,
  LogOut,
  ShieldCheck,
  Terminal,
  Wand2,
} from "lucide-react";
import { useState } from "react";
import { NodeCard, type NodeTheme } from "./NodeCard";

const passBadge = <span className="text-[10px] font-medium text-green-500">Pass</span>;
const queuedBadge = <span className="text-[10px] font-medium text-gray-500">Queued</span>;

const sampleBody = (
  <>
    <div className="flex items-center justify-between text-[10px] text-gray-500">
      <span>Checks</span>
      <span>3 rules</span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
      <div className="h-full w-2/3 rounded-full bg-emerald-400" />
    </div>
    <p className="text-[10px] leading-relaxed text-gray-500">
      Runs format, lint, and focused tests before continuing.
    </p>
  </>
);

const themeCases: Array<{ icon: React.ElementType; label: string; theme: NodeTheme }> = [
  { icon: Box, label: "Input", theme: "emerald" },
  { icon: Wand2, label: "Skill", theme: "violet" },
  { icon: ShieldCheck, label: "Condition", theme: "amber" },
  { icon: LogOut, label: "Output", theme: "sky" },
  { icon: GitBranch, label: "Branch", theme: "orange" },
  { icon: Terminal, label: "Command", theme: "teal" },
  { icon: Clock, label: "Schedule", theme: "indigo" },
];

const meta: Meta<typeof NodeCard> = {
  title: "HarnessCanvas/NodeCard",
  component: NodeCard,
  tags: ["autodocs"],
  args: {
    icon: Box,
    label: "Example Node",
    theme: "emerald",
  },
  argTypes: {
    runStatus: {
      control: "select",
      options: [undefined, "running", "pass", "fail"],
    },
    theme: {
      control: "select",
      options: ["emerald", "violet", "amber", "sky", "orange", "teal", "indigo"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "Canvas node card used inside pipeline graphs. Use these stories to check header alignment, truncation, body spacing, theme colors, selection, run status, and dimmed states before validating the full canvas.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof NodeCard>;

export const Default: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story: "Baseline card with only icon, label, theme, and the rectangular header band.",
      },
    },
  },
};

export const WithDescription: Story = {
  args: {
    description: "Reads source files and emits a typed snapshot.",
    icon: Wand2,
    label: "Source Scanner",
    theme: "violet",
  },
};

export const LongLabel: Story = {
  args: {
    description: "Long description should remain readable without destroying layout",
    headerRight: passBadge,
    icon: Wand2,
    label: "Very Long Node Name That Should Not Break The Card Layout",
    theme: "violet",
  },
  parameters: {
    docs: {
      description: {
        story: "Stress case for long titles, long descriptions, and right-side header content.",
      },
    },
  },
};

export const LongDescription: Story = {
  args: {
    description:
      "This description is intentionally verbose so truncation and vertical centering can be checked at the card boundary.",
    headerRight: queuedBadge,
    icon: Terminal,
    label: "Command Runner",
    theme: "teal",
  },
};

export const Emerald: Story = {
  args: { icon: Box, label: "Input Node", theme: "emerald" },
};

export const Violet: Story = {
  args: { icon: Wand2, label: "Skill Node", theme: "violet" },
};

export const Amber: Story = {
  args: { icon: ShieldCheck, label: "Condition Node", theme: "amber" },
};

export const Sky: Story = {
  args: { icon: LogOut, label: "Output Node", theme: "sky" },
};

export const Selected: Story = {
  args: {
    icon: Wand2,
    label: "Selected Node",
    selected: true,
    theme: "violet",
  },
};

export const WithBody: Story = {
  args: {
    bodyClassName: "space-y-2",
    children: sampleBody,
    icon: Box,
    label: "Node with Body",
    theme: "emerald",
  },
};

export const WithHeaderRight: Story = {
  args: {
    headerRight: passBadge,
    icon: Wand2,
    label: "Node with Status",
    theme: "violet",
  },
};

export const EditableLabel: Story = {
  parameters: {
    docs: {
      description: {
        story: "Interactive case for inline title editing through the onLabelChange callback.",
      },
    },
  },
  render: () => {
    const [label, setLabel] = useState("Editable Node");
    const handleLabelChange = (value: string) => setLabel(value);

    return (
      <NodeCard
        description="Click the title and type."
        headerRight={queuedBadge}
        icon={Terminal}
        label={label}
        theme="teal"
        onLabelChange={handleLabelChange}
      />
    );
  },
};

export const Running: Story = {
  args: {
    description: "Executing pipeline checks.",
    headerRight: <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-500" />,
    icon: Terminal,
    label: "Running Node",
    runStatus: "running",
    theme: "sky",
  },
};

export const Passed: Story = {
  args: {
    description: "All checks completed.",
    headerRight: <CircleCheck className="h-3.5 w-3.5 text-green-500" />,
    icon: ShieldCheck,
    label: "Passed Node",
    runStatus: "pass",
    theme: "emerald",
  },
};

export const Failed: Story = {
  args: {
    description: "One check needs attention.",
    headerRight: <CircleX className="h-3.5 w-3.5 text-red-500" />,
    icon: ShieldCheck,
    label: "Failed Node",
    runStatus: "fail",
    theme: "amber",
  },
};

export const Dimmed: Story = {
  args: {
    description: "Disabled while another branch runs.",
    dimmed: true,
    headerRight: queuedBadge,
    icon: GitBranch,
    label: "Dimmed Node",
    theme: "orange",
  },
};

export const AllThemes: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      {themeCases.map(({ icon, label, theme }) => (
        <NodeCard key={theme} icon={icon} label={label} theme={theme} />
      ))}
    </div>
  ),
};

export const ContentMatrix: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Compact visual matrix for checking header-only, description, long content, body, selected, and dimmed variants together.",
      },
    },
  },
  render: () => (
    <div className="grid max-w-5xl grid-cols-[repeat(auto-fit,minmax(18rem,18rem))] gap-4 p-4">
      <NodeCard icon={Box} label="Header Only" theme="emerald" />
      <NodeCard
        description="Single-line description."
        icon={Wand2}
        label="With Description"
        theme="violet"
      />
      <NodeCard
        description="Long description should truncate cleanly inside the rectangular band."
        headerRight={passBadge}
        icon={Terminal}
        label="Very Long Node Name That Should Not Break The Header"
        theme="teal"
      />
      <NodeCard bodyClassName="space-y-2" icon={ShieldCheck} label="With Body" theme="amber">
        {sampleBody}
      </NodeCard>
      <NodeCard
        selected
        description="Selected item in the canvas."
        icon={GitBranch}
        label="Selected"
        theme="orange"
      />
      <NodeCard
        dimmed
        description="Unavailable during execution."
        headerRight={queuedBadge}
        icon={Clock}
        label="Dimmed"
        theme="indigo"
      />
    </div>
  ),
};

export const RunStatusMatrix: Story = {
  parameters: {
    docs: {
      description: {
        story: "Run-state matrix covering queued, running, pass, and fail visual treatments.",
      },
    },
  },
  render: () => (
    <div className="flex flex-wrap gap-4 p-4">
      <NodeCard
        description="Waiting for execution."
        headerRight={queuedBadge}
        icon={Clock}
        label="Queued"
        theme="indigo"
      />
      <NodeCard
        description="Pipeline is running."
        headerRight={<LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-500" />}
        icon={Terminal}
        label="Running"
        runStatus="running"
        theme="sky"
      />
      <NodeCard
        description="All checks passed."
        headerRight={<CircleCheck className="h-3.5 w-3.5 text-green-500" />}
        icon={ShieldCheck}
        label="Passed"
        runStatus="pass"
        theme="emerald"
      />
      <NodeCard
        description="Fix required."
        headerRight={<CircleX className="h-3.5 w-3.5 text-red-500" />}
        icon={ShieldCheck}
        label="Failed"
        runStatus="fail"
        theme="amber"
      />
    </div>
  ),
};
