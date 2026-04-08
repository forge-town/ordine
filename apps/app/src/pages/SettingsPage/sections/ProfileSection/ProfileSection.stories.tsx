import type { Meta, StoryObj } from "@storybook/react";
import { ProfileSection } from "./ProfileSection";

const meta: Meta<typeof ProfileSection> = {
  title: "Pages/SettingsPage/sections/ProfileSection",
  component: ProfileSection,
};

export default meta;

type Story = StoryObj<typeof ProfileSection>;

export const Default: Story = {
  args: {
    values: {
      displayName: "Ordine 用户",
      email: "user@ordine.app",
      bio: "Skill Pipeline 设计师",
    },
    onChange: () => {},
    onSave: () => {},
    saved: false,
  },
};
