import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { canvasStoryBestPractices } from "../../storybookData";
import { BestPracticeSelect } from "./BestPracticeSelect";

const BestPracticeSelectStory = (args: React.ComponentProps<typeof BestPracticeSelect>) => {
  const [value, setValue] = useState(args.value);
  const handleValueChange = (id: string | undefined, name: string | undefined) => {
    args.onValueChange(id, name);
    setValue(id);
  };

  return <BestPracticeSelect {...args} value={value} onValueChange={handleValueChange} />;
};

const bestPractices = canvasStoryBestPractices.map(({ id, title }) => ({ id, title }));

const meta: Meta<typeof BestPracticeSelect> = {
  title: "CanvasPage/OperationNode/BestPracticeSelect",
  component: BestPracticeSelect,
  tags: ["autodocs"],
  args: {
    bestPractices,
    value: "bp-strict-review",
    onValueChange: () => undefined,
  },
  parameters: {
    docs: {
      description: {
        component: "Small selector used by operation nodes to choose a Best Practice preset.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof BestPracticeSelect>;

export const Selected: Story = {
  render: (args) => <BestPracticeSelectStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Best Practice selector with a current value.",
      },
    },
  },
};

export const Empty: Story = {
  args: {
    value: undefined,
  },
  render: (args) => <BestPracticeSelectStory {...args} />,
  parameters: {
    docs: {
      description: {
        story: "Selector before a Best Practice has been chosen.",
      },
    },
  },
};
