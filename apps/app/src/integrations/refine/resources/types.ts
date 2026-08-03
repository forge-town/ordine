import type { GetListParams } from "@refinedev/core";

export type ListFilters = {
  string: (field: string) => string | undefined;
  number: (field: string) => number | undefined;
  boolean: (field: string) => boolean | undefined;
};

export type ResourceHandlers = {
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
