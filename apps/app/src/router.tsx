import { createRouter } from "@tanstack/react-router";
import { Provider } from "@/integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen.ts";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }) => {
      return <Provider>{children}</Provider>;
    },
  });

  return router;
};
