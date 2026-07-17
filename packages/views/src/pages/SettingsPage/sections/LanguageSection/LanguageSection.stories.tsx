import type { Meta, StoryObj } from "@storybook/react";
import { SettingsPageStoreProvider } from "../../_store";
import { LanguageSection } from "./LanguageSection";

const meta: Meta<typeof LanguageSection> = {
  title: "Pages/SettingsPage/sections/LanguageSection",
  component: LanguageSection,
  decorators: [
    (Story) => (
      <SettingsPageStoreProvider
        initialSettings={{
          language: { language: "zh-CN", timezone: "Asia/Shanghai" },
        }}
      >
        <Story />
      </SettingsPageStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LanguageSection>;

export const Default: Story = {};
