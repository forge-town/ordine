import { RouterProvider } from "@tanstack/react-router";
import { desktopRouter } from "../integrations/router";

export const DesktopWorkspaceContent = () => <RouterProvider router={desktopRouter} />;
