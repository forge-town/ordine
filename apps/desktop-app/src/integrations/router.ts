import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../routeTree.gen";

export const desktopRouter = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof desktopRouter;
  }
}
