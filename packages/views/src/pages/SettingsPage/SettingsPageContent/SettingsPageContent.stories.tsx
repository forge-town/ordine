import type { Meta, StoryObj } from "@storybook/react";
import { AutonomyStoreProvider } from "../../../store/autonomyStore";
import { NotificationStoreProvider } from "../../../store/notificationStore";
import { SidebarStoreProvider } from "../../../store/sidebarStore";
import { ThemeApplier, ThemeStoreProvider } from "../../../store/themeStore";
import { SettingsPageStoreProvider } from "../_store";
import { SettingsPageContent } from "./SettingsPageContent";

const meta: Meta<typeof SettingsPageContent> = {
  title: "Pages/SettingsPage/SettingsPageContent",
  component: SettingsPageContent,
  decorators: [
    (Story) => (
      <ThemeStoreProvider>
        <NotificationStoreProvider>
          <AutonomyStoreProvider>
            <SidebarStoreProvider>
              <SettingsPageStoreProvider>
                <ThemeApplier />
                <Story />
              </SettingsPageStoreProvider>
            </SidebarStoreProvider>
          </AutonomyStoreProvider>
        </NotificationStoreProvider>
      </ThemeStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsPageContent>;

export const Default: Story = {};
