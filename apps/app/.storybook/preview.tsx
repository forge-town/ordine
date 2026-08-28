import React from "react";
import type { Preview } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Refine } from "@refinedev/core";
import { ToastStoreProvider } from "@repo/views/store/toastStore";
import { PlatformProvider } from "@repo/views/platform";
import { UiMotionProvider } from "@repo/ui/motion";
import { canvasStoryDataProvider } from "../../../packages/views/src/pages/CanvasPage/storybookData";
import { webPlatform } from "../src/integrations/platform";
import "@xyflow/react/dist/style.css";
import "../src/lib/i18n";
import "../src/styles.css";

const rootRoute = createRootRoute();
const router = createRouter({
  routeTree: rootRoute,
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: "todo",
    },
  },
  decorators: [
    (Story) => (
      <UiMotionProvider>
        <QueryClientProvider client={queryClient}>
          <Refine dataProvider={canvasStoryDataProvider}>
            <PlatformProvider value={webPlatform}>
              <ToastStoreProvider>
                <RouterContextProvider router={router}>
                  <Story />
                </RouterContextProvider>
              </ToastStoreProvider>
            </PlatformProvider>
          </Refine>
        </QueryClientProvider>
      </UiMotionProvider>
    ),
  ],
};

export default preview;
