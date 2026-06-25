import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { Refine } from "@refinedev/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlatformProvider } from "@repo/views/platform";
import { routeTree } from "./routeTree.gen";
import { dataProvider } from "./integrations/refine/dataProvider";
import { desktopPlatform } from "./integrations/platform";
import { ServerGate } from "./components/ServerGate";
import "./lib/i18n";
import "./styles.css";

const router = createRouter({ routeTree });
const queryClient = new QueryClient();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.querySelector("#root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ServerGate>
        <QueryClientProvider client={queryClient}>
          <Refine dataProvider={dataProvider}>
            <PlatformProvider value={desktopPlatform}>
              <RouterProvider router={router} />
            </PlatformProvider>
          </Refine>
        </QueryClientProvider>
      </ServerGate>
    </StrictMode>,
  );
}
