import type { OperationEntity } from "@repo/models";
import type { ObjectType } from "@repo/schemas";

type OperationResult = {
  id: string;
  name: string;
  description: string | null;
  config: string;
  acceptedObjectTypes: ObjectType[];
  createdAt: number;
  updatedAt: number;
};

type OperationsDao = {
  findMany: () => Promise<OperationEntity[]>;
  findById: (id: string) => Promise<OperationEntity | null>;
  create: (data: Omit<OperationEntity, "createdAt" | "updatedAt">) => Promise<OperationEntity>;
  update: (
    id: string,
    data: Partial<Omit<OperationEntity, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<OperationEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createOperationsService = (dao: OperationsDao) => ({
  getAll: async (): Promise<OperationResult[]> => {
    const ops = await dao.findMany();
    return ops as OperationResult[];
  },
  getById: async (id: string): Promise<OperationResult | null> => {
    const op = await dao.findById(id);
    return op as OperationResult | null;
  },
  create: async (
    data: Omit<OperationEntity, "createdAt" | "updatedAt">,
  ): Promise<OperationResult> => {
    const op = await dao.create(data);
    return op as OperationResult;
  },
  update: async (
    id: string,
    data: Partial<Omit<OperationEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<OperationResult | null> => {
    const op = await dao.update(id, data);
    return op as OperationResult | null;
  },
  delete: (id: string) => dao.delete(id),
});
