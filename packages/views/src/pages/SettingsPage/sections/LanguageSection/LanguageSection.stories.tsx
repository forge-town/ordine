import type { Meta, StoryObj } from "@storybook/react";
import { ThemeApplier, ThemeStoreProvider } from "../../../../store/themeStore";
import { SettingsPageStoreProvider } from "../../_store";
import { LanguageSection } from "./LanguageSection";

const meta: Meta<typeof LanguageSection> = {
  title: "Pages/SettingsPage/sections/LanguageSection",
  component: LanguageSection,
  decorators: [
    (Story) => (
      <ThemeStoreProvider>
        <SettingsPageStoreProvider
          initialSettings={{
            language: { language: "zh-CN", timezone: "Asia/Shanghai" },
          }}
        >
          <ThemeApplier />
          <Story />
        </SettingsPageStoreProvider>
      </ThemeStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LanguageSection>;

export const Default: Story = {};
