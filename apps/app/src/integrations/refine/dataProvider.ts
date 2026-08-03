import {
  type BaseRecord,
  type CreateParams,
  type CreateResponse,
  type DataProvider,
  type DeleteOneParams,
  type DeleteOneResponse,
  type GetListParams,
  type GetListResponse,
  type GetOneParams,
  type GetOneResponse,
  type UpdateParams,
  type UpdateResponse,
} from "@refinedev/core";
import { customEndpoints } from "./resources/custom";
import { resourceHandlers } from "./resources/registry";
import { makeListFilters, type ResourceHandlers } from "./resources/types";

export { CustomEndpoint } from "./resources/custom";
export { ResourceName } from "./resources/resourceNames";

const handlerFor = <Method extends keyof ResourceHandlers>(
  method: Method,
  resource: string,
): NonNullable<ResourceHandlers[Method]> => {
  const handler = resourceHandlers[resource]?.[method];
  if (!handler) throw new Error(`${method}: unknown resource "${resource}"`);

  return handler as NonNullable<ResourceHandlers[Method]>;
};

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const data = await handlerFor("getList", params.resource)(params, makeListFilters(params));

    return { data: data as TData[], total: data.length };
  },
  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => ({
    data: (await handlerFor("getOne", params.resource)(String(params.id))) as TData,
  }),
  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => ({
    data: (await handlerFor("create", params.resource)(params.variables)) as TData,
  }),
  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => ({
    data: (await handlerFor("update", params.resource)(
      String(params.id),
      params.variables,
    )) as TData,
  }),
  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => ({
    data: (await handlerFor("deleteOne", params.resource)(String(params.id))) as TData,
  }),
  getApiUrl: () => "",
  custom: async <
    TData extends BaseRecord = BaseRecord,
    _TQuery = unknown,
    TPayload = unknown,
  >(params: {
    url: string;
    method: string;
    payload?: TPayload;
  }): Promise<{ data: TData }> => {
    const handler = customEndpoints[params.url];
    if (!handler) throw new Error(`custom: unknown url "${params.url}"`);

    return { data: (await handler(params.payload)) as TData };
  },
};
