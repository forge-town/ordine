import type { Meta, StoryObj } from "@storybook/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OperationDetailPageContent } from "./OperationDetailPageContent";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const rootRoute = createRootRoute();
const opRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/operations/$operationId",
  component: OperationDetailPageContent,
});
rootRoute.addChildren([opRoute]);

const router = createRouter({
  routeTree: rootRoute.addChildren([opRoute]),
  history: createMemoryHistory({ initialEntries: ["/operations/op-1"] }),
});

const meta: Meta<typeof OperationDetailPageContent> = {
  title: "Pages/OperationDetailPage/OperationDetailPageContent",
  component: OperationDetailPageContent,
  decorators: [
    () => (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router as never} />
      </QueryClientProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof OperationDetailPageContent>;

export const Default: Story = {};
