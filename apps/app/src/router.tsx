import { createRouter } from "@tanstack/react-router";
import { Provider } from "@/integrations/tanstack-query/root-provider";
import { RefineProvider } from "@/integrations/refine/provider";
import { routeTree } from "./routeTree.gen.ts";

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
  Wrap: ({ children }) => {
    return (
      <Provider>
        <RefineProvider>{children}</RefineProvider>
      </Provider>
    );
  },
});

export const getRouter = () => router;
