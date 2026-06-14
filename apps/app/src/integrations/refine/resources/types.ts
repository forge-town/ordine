import type { GetListParams } from "@refinedev/core";

/**
 * 资源 handler 注册表的契约（H3-03）。
 * 每个资源声明它支持的方法；dataProvider 只做查找 + 统一响应封装 + 兜底报错，
 * 不再为每个方法维护一个 80 分支的 switch。新增资源 = 注册表加一条目，不动 dataProvider。
 */

/** getList 过滤器读取器（封装原 getStringFilter/getNumberFilter/getBooleanFilter）。 */
export type ListFilters = {
  string: (field: string) => string | undefined;
  number: (field: string) => number | undefined;
  boolean: (field: string) => boolean | undefined;
};

export type ResourceHandlers = {
  /** 返回原始数组；dataProvider 负责 `{ data, total: data.length }` 封装与泛型 cast。 */
  getList?: (params: GetListParams, filters: ListFilters) => Promise<unknown[]>;
  getOne?: (id: string) => Promise<unknown>;
  create?: (variables: unknown) => Promise<unknown>;
  update?: (id: string, variables: unknown) => Promise<unknown>;
  deleteOne?: (id: string) => Promise<unknown>;
};

export const makeListFilters = (params: GetListParams): ListFilters => {
  const raw = (field: string): unknown => {
    const filter = params.filters?.find((item) => "field" in item && item.field === field);

    return filter && "value" in filter ? filter.value : undefined;
  };

  return {
    string: (field) => {
      const value = raw(field);

      return typeof value === "string" ? value : undefined;
    },
    number: (field) => {
      const value = raw(field);
      if (typeof value === "number") return value;
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const parsed = Number(value);

      return Number.isFinite(parsed) ? parsed : undefined;
    },
    boolean: (field) => {
      const value = raw(field);
      if (typeof value === "boolean") return value;
      if (value === "true") return true;
      if (value === "false") return false;

      return undefined;
    },
  };
};
