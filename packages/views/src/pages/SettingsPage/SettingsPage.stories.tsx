import type { Meta, StoryObj } from "@storybook/react";
import { AutonomyStoreProvider } from "../../store/autonomyStore";
import { NotificationStoreProvider } from "../../store/notificationStore";
import { SidebarStoreProvider } from "../../store/sidebarStore";
import { ThemeApplier, ThemeStoreProvider } from "../../store/themeStore";
import { SettingsPage } from "./SettingsPage";

const meta: Meta<typeof SettingsPage> = {
  title: "Pages/SettingsPage",
  component: SettingsPage,
  decorators: [
    (Story) => (
      <ThemeStoreProvider>
        <NotificationStoreProvider>
          <AutonomyStoreProvider>
            <SidebarStoreProvider>
              <ThemeApplier />
              <Story />
            </SidebarStoreProvider>
          </AutonomyStoreProvider>
        </NotificationStoreProvider>
      </ThemeStoreProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsPage>;

export const Default: Story = {};
