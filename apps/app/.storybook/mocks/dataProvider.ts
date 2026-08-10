import type { DataProvider } from "@refinedev/core";
export { ResourceName } from "../../src/integrations/refine/resources/resourceNames";

export const CustomEndpoint = {
  pipelinesRun: "pipelines/run",
} as const;

export const dataProvider = {
  create: async ({ variables }) => ({ data: variables }),
  custom: async () => ({ data: {} }),
  deleteOne: async ({ id }) => ({ data: { id } }),
  getApiUrl: () => "",
  getList: async () => ({ data: [], total: 0 }),
  getOne: async () => ({ data: null }),
  update: async ({ id, variables }) => ({ data: { id, ...variables } }),
} as unknown as DataProvider;
