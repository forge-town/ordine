import type { Meta, StoryObj } from "@storybook/react";
import { SettingsPageContent } from "./SettingsPageContent";

const meta: Meta<typeof SettingsPageContent> = {
  title: "Pages/SettingsPage/SettingsPageContent",
  component: SettingsPageContent,
};

export default meta;

type Story = StoryObj<typeof SettingsPageContent>;

export const Default: Story = {};
