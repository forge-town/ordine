import type { Meta, StoryObj } from "@storybook/react";
import { LanguageSection } from "./LanguageSection";

const meta: Meta<typeof LanguageSection> = {
  title: "Pages/SettingsPage/sections/LanguageSection",
  component: LanguageSection,
};

export default meta;

type Story = StoryObj<typeof LanguageSection>;

export const Default: Story = {
  args: {
    values: { language: "zh-CN", timezone: "Asia/Shanghai" },
    onChange: () => {},
    onSave: () => {},
    saved: false,
  },
};
