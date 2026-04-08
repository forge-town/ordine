import type { Meta, StoryObj } from "@storybook/react";
import { RulesPage } from "./RulesPage";

const meta: Meta<typeof RulesPage> = {
  title: "Pages/RulesPage",
  component: RulesPage,
};

export default meta;

type Story = StoryObj<typeof RulesPage>;

export const Default: Story = {};
