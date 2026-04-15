import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { operationsDao } from "@repo/models";
import { type ObjectType, ObjectTypeSchema as ObjectTypeEnum } from "@repo/schemas";

type OperationResult = {
  id: string;
  name: string;
  description: string | null;
  config: string;
  acceptedObjectTypes: ObjectType[];
  createdAt: number;
  updatedAt: number;
};

export const getOperations = createServerFn({ method: "GET" }).handler(async () => {
  const ops = await operationsDao.findMany();
  return ops as OperationResult[];
});

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
      config: z.string().default("{}"),
      acceptedObjectTypes: z.array(ObjectTypeEnum).default(["file", "folder", "project"]),
    })
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
      config: z.string().optional(),
      acceptedObjectTypes: z.array(ObjectTypeEnum).optional(),
    })
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const op = await operationsDao.update(id, rest);
    return op as OperationResult;
  });

export const deleteOperation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => operationsDao.delete(data.id));
