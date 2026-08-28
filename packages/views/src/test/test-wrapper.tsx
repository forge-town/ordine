import {
  Refine,
  type BaseRecord,
  type CreateParams,
  type DataProvider,
  type DeleteOneParams,
  type GetOneParams,
  type UpdateParams,
} from "@refinedev/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender, type RenderOptions } from "@testing-library/react";
import { PlatformProvider, type PlatformCapabilities } from "../platform";
import { ToastStoreContext, createToastStore } from "../store/toastStore";
import { UiMotionProvider } from "@repo/ui/motion";
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
  getOne: async <TData extends BaseRecord>({ id }: GetOneParams) => ({
    data: { id } as TData,
  }),
  create: async <TData extends BaseRecord, TVariables>({
    variables,
  }: CreateParams<TVariables>) => ({
    data: { id: "1", ...variables } as unknown as TData,
  }),
  update: async <TData extends BaseRecord, TVariables>({
    id,
    variables,
  }: UpdateParams<TVariables>) => ({
    data: { id, ...variables } as unknown as TData,
  }),
  deleteOne: async <TData extends BaseRecord, TVariables>({ id }: DeleteOneParams<TVariables>) => ({
    data: { id } as TData,
  }),
  getApiUrl: () => "http://localhost:9433/api",
  custom: async <TData extends BaseRecord>() => ({ data: {} as TData }),
};

const testPlatform: PlatformCapabilities = {
  apiBaseUrl: "http://localhost:9433/api",
  copyText: async () => undefined,
  downloadBlob: () => undefined,
  request: (input, init) => globalThis.fetch(input, init),
};

export const TestWrapper = ({ children }: React.PropsWithChildren) => {
  const queryClient = createTestQueryClient();
  const toastStore = createToastStore();

  return (
    <UiMotionProvider>
      <QueryClientProvider client={queryClient}>
        <Refine dataProvider={canvasTestDataProvider}>
          <PlatformProvider value={testPlatform}>
            <ToastStoreContext.Provider value={toastStore}>{children}</ToastStoreContext.Provider>
          </PlatformProvider>
        </Refine>
      </QueryClientProvider>
    </UiMotionProvider>
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
