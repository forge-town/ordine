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
import { resourceHandlers } from "./resources/registry";
import { customEndpoints } from "./resources/custom";
import { makeListFilters, type ResourceHandlers } from "./resources/types";

export { ResourceName } from "./resources/resourceNames";
export { CustomEndpoint } from "./resources/custom";

/** 取某资源的某方法，缺失即抛——与迁移前每个 switch 的 default 行为一致。 */
const handlerFor = <M extends keyof ResourceHandlers>(
  method: M,
  resource: string,
): NonNullable<ResourceHandlers[M]> => {
  const fn = resourceHandlers[resource]?.[method];
  if (!fn) {
    throw new Error(`${method}: unknown resource "${resource}"`);
  }

  return fn as NonNullable<ResourceHandlers[M]>;
};

export const dataProvider: DataProvider = {
  getList: async <TData extends BaseRecord = BaseRecord>(
    params: GetListParams,
  ): Promise<GetListResponse<TData>> => {
    const data = await handlerFor("getList", params.resource)(params, makeListFilters(params));

    return { data: data as unknown as TData[], total: data.length };
  },

  getOne: async <TData extends BaseRecord = BaseRecord>(
    params: GetOneParams,
  ): Promise<GetOneResponse<TData>> => {
    const data = await handlerFor("getOne", params.resource)(String(params.id));

    return { data: data as unknown as TData };
  },

  create: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: CreateParams<TVariables>,
  ): Promise<CreateResponse<TData>> => {
    const data = await handlerFor("create", params.resource)(params.variables);

    return { data: data as unknown as TData };
  },

  update: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: UpdateParams<TVariables>,
  ): Promise<UpdateResponse<TData>> => {
    const data = await handlerFor("update", params.resource)(String(params.id), params.variables);

    return { data: data as unknown as TData };
  },

  deleteOne: async <TData extends BaseRecord = BaseRecord, TVariables = object>(
    params: DeleteOneParams<TVariables>,
  ): Promise<DeleteOneResponse<TData>> => {
    const data = await handlerFor("deleteOne", params.resource)(String(params.id));

    return { data: data as unknown as TData };
  },

  getApiUrl: () => "",

  custom: async <TData extends BaseRecord = BaseRecord, _TQuery = unknown, TPayload = unknown>(
    params: {
      url: string;
      method: string;
      payload?: TPayload;
    },
  ): Promise<{ data: TData }> => {
    const handler = customEndpoints[params.url];
    if (!handler) {
      throw new Error(`custom: unknown url "${params.url}"`);
    }
    const data = await handler(params.payload);

    return { data: data as unknown as TData };
  },
};
