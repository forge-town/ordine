import { Refine, type DataProvider } from "@refinedev/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { PlatformProvider, type PlatformCapabilities } from "../platform";
import { ToastStoreContext, createToastStore } from "../store/toastStore";
import "./use-test-language";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

export const canvasTestDataProvider: DataProvider = {
  getList: async () => ({ data: [], total: 0 }),
  getMany: async () => ({ data: [] }),
  getOne: async ({ id }) => ({ data: { id } }),
  create: async ({ variables }) => ({ data: variables as { id: string } }),
  update: async ({ id, variables }) => ({ data: { id, ...variables } }),
  deleteOne: async ({ id }) => ({ data: { id } }),
  getApiUrl: () => "http://localhost:9433/api",
};

const testPlatform: PlatformCapabilities = {
  apiBaseUrl: "http://localhost:9433/api",
  downloadBlob: () => undefined,
  request: (input, init) => globalThis.fetch(input, init),
};

export const TestWrapper = ({ children }: React.PropsWithChildren) => {
  const queryClient = createTestQueryClient();
  const toastStore = createToastStore();

  return (
    <QueryClientProvider client={queryClient}>
      <Refine dataProvider={canvasTestDataProvider}>
        <PlatformProvider value={testPlatform}>
          <ToastStoreContext.Provider value={toastStore}>{children}</ToastStoreContext.Provider>
        </PlatformProvider>
      </Refine>
    </QueryClientProvider>
  );
};

type CustomRenderOptions = Omit<RenderOptions, "wrapper"> & {
  wrapper?: React.ComponentType<React.PropsWithChildren>;
};

export const render = (ui: React.ReactElement, options: CustomRenderOptions = {}) => {
  const { wrapper: UserWrapper, ...rest } = options;
  const Wrapper = UserWrapper
    ? ({ children }: React.PropsWithChildren) => (
        <TestWrapper>
          <UserWrapper>{children}</UserWrapper>
        </TestWrapper>
      )
    : TestWrapper;

  return rtlRender(ui, { ...rest, wrapper: Wrapper });
};
