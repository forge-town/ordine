import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { operationsDao } from "@/models/daos/operationsDao";
import {
  VISIBILITY_OPTIONS,
  type ObjectType,
  type Visibility,
} from "@/models/tables/operations_table";
import { ObjectTypeSchema as ObjectTypeEnum } from "@/schemas";

const VisibilityEnum = z.enum(VISIBILITY_OPTIONS);

type OperationResult = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  visibility: Visibility;
  config: string;
  acceptedObjectTypes: ObjectType[];
  createdAt: number;
  updatedAt: number;
};

export const getOperations = createServerFn({ method: "GET" }).handler(
  async () => {
    const ops = await operationsDao.findMany();
    return ops as OperationResult[];
  },
);

export const getOperationById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const op = await operationsDao.findById(data.id);
    return op as OperationResult | null;
  });

export const createOperation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().default(null),
      category: z.string().default("general"),
      visibility: VisibilityEnum.default("public"),
      config: z.string().default("{}"),
      acceptedObjectTypes: z
        .array(ObjectTypeEnum)
        .default(["file", "folder", "project"]),
    }),
  )
  .handler(async ({ data }) => {
    const op = await operationsDao.create(data);
    return op as OperationResult;
  });

export const updateOperation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      category: z.string().optional(),
      visibility: VisibilityEnum.optional(),
      config: z.string().optional(),
      acceptedObjectTypes: z.array(ObjectTypeEnum).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const op = await operationsDao.update(id, rest);
    return op as OperationResult;
  });

export const deleteOperation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => operationsDao.delete(data.id));
