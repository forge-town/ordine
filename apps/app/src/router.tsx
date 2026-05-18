import { createRouter } from "@tanstack/react-router";
import { Provider } from "@/integrations/tanstack-query/root-provider";
import { RefineProvider } from "@/integrations/refine/provider";
import { routeTree } from "./routeTree.gen.ts";

const createAppRouter = () =>
  createRouter({
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

type AppRouter = ReturnType<typeof createAppRouter>;

const browserState: { router: AppRouter | undefined } = { router: undefined };

export const getRouter = () => {
  if (globalThis.document === undefined) {
    return createAppRouter();
  }

  if (!browserState.router) {
    browserState.router = createAppRouter();
  }

  return browserState.router;
};

export const router: Pick<AppRouter, "navigate"> = {
  navigate: ((options) => getRouter().navigate(options as never)) as AppRouter["navigate"],
};
