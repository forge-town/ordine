import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastStoreContext, createToastStore } from "@/store/toastStore";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

export const TestWrapper = ({ children }: React.PropsWithChildren) => {
  const queryClient = createTestQueryClient();
  const toastStore = createToastStore();

  return (
    <QueryClientProvider client={queryClient}>
      <ToastStoreContext.Provider value={toastStore}>{children}</ToastStoreContext.Provider>
    </QueryClientProvider>
  );
};

type CustomRenderOptions = Omit<RenderOptions, "wrapper"> & {
  wrapper?: React.ComponentType<React.PropsWithChildren>;
};

export function render(ui: React.ReactElement, options: CustomRenderOptions = {}) {
  const { wrapper: UserWrapper, ...rest } = options;

  const Wrapper = UserWrapper
    ? ({ children }: React.PropsWithChildren) => (
        <TestWrapper>
          <UserWrapper>{children}</UserWrapper>
        </TestWrapper>
      )
    : TestWrapper;

  return rtlRender(ui, { ...rest, wrapper: Wrapper });
}
