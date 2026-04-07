import {
  type DataProvider,
  type BaseRecord,
  type GetListParams,
  type GetListResponse,
  type GetOneParams,
  type GetOneResponse,
  type CreateParams,
  type CreateResponse,
  type UpdateParams,
  type UpdateResponse,
  type DeleteOneParams,
  type DeleteOneResponse,
} from "@refinedev/core";
import {
  getOperations,
  getOperationById,
  createOperation,
  updateOperation,
  deleteOperation,
} from "@/services/operationsService";
import {
  getPipelines,
  getPipelineById,
  createPipeline,
  updatePipeline,
  deletePipeline,
} from "@/services/pipelinesService";

export const ResourceName = {
  operations: "operations",
  pipelines: "pipelines",
} as const;

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const { resource } = params;

    switch (resource) {
      case ResourceName.operations: {
        const data = await getOperations();
        return { data: data as unknown as TData[], total: data.length };
      }
      case ResourceName.pipelines: {
        const data = await getPipelines();
        return { data: data as unknown as TData[], total: data.length };
      }
      default: {
        throw new Error(`getList: unknown resource "${resource}"`);
      }
    }
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const { resource, id } = params;

    switch (resource) {
      case ResourceName.operations: {
        const data = await getOperationById({ data: { id: String(id) } });
        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await getPipelineById({ data: { id: String(id) } });
        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`getOne: unknown resource "${resource}"`);
      }
    }
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const { resource, variables } = params;

    switch (resource) {
      case ResourceName.operations: {
        const data = await createOperation({
          data: variables as Parameters<typeof createOperation>[0]["data"],
        });
        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await createPipeline({
          data: variables as Parameters<typeof createPipeline>[0]["data"],
        });
        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`create: unknown resource "${resource}"`);
      }
    }
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const { resource, id, variables } = params;

    switch (resource) {
      case ResourceName.operations: {
        const { id: _varId, ...rest } = variables as Record<string, unknown>;
        const data = await updateOperation({
          data: { id: String(id), ...rest } as Parameters<
            typeof updateOperation
          >[0]["data"],
        });
        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await updatePipeline({
          data: {
            id: String(id),
            patch: variables as Record<string, unknown>,
          },
        });
        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`update: unknown resource "${resource}"`);
      }
    }
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const { resource, id } = params;

    switch (resource) {
      case ResourceName.operations: {
        const data = await deleteOperation({ data: { id: String(id) } });
        return { data: data as unknown as TData };
      }
      case ResourceName.pipelines: {
        const data = await deletePipeline({ data: { id: String(id) } });
        return { data: data as unknown as TData };
      }
      default: {
        throw new Error(`deleteOne: unknown resource "${resource}"`);
      }
    }
  },

  getApiUrl: () => "",
};
