import type { Meta, StoryObj } from "@storybook/react";
import { SettingsStoreProvider } from "../_store";
import { SettingsPageContent } from "./SettingsPageContent";

const meta: Meta<typeof SettingsPageContent> = {
  title: "Pages/SettingsPage/SettingsPageContent",
  component: SettingsPageContent,
  decorators: [
    (Story) => (
      <SettingsStoreProvider>
        <Story />
      </SettingsStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsPageContent>;

export const Default: Story = {};
