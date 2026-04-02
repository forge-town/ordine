import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { operationsDao } from "@/models/daos/operationsDao";
import { OBJECT_TYPES, type ObjectType } from "@/models/tables/operations_table";

const ObjectTypeEnum = z.enum(OBJECT_TYPES);

export const getOperations = createServerFn({ method: "GET" }).handler(async () => {
  const ops = await operationsDao.findMany();
  return ops as Array<{
    id: string;
    name: string;
    description: string | null;
    category: string;
    config: string;
    acceptedObjectTypes: ObjectType[];
    createdAt: number;
    updatedAt: number;
  }>;
});

export const getOperationById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const op = await operationsDao.findById(data.id);
    return op as {
      id: string;
      name: string;
      description: string | null;
      category: string;
      config: string;
      acceptedObjectTypes: ObjectType[];
      createdAt: number;
      updatedAt: number;
    } | null;
  });

export const createOperation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable().default(null),
      category: z.string().default("general"),
      config: z.string().default("{}"),
      acceptedObjectTypes: z.array(ObjectTypeEnum).default(["file", "folder", "project"]),
    }),
  )
  .handler(async ({ data }) => {
    const op = await operationsDao.create(data);
    return op as {
      id: string;
      name: string;
      description: string | null;
      category: string;
      config: string;
      acceptedObjectTypes: ObjectType[];
      createdAt: number;
      updatedAt: number;
    };
  });

export const updateOperation = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().nullable().optional(),
      category: z.string().optional(),
      config: z.string().optional(),
      acceptedObjectTypes: z.array(ObjectTypeEnum).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    const op = await operationsDao.update(id, rest);
    return op as {
      id: string;
      name: string;
      description: string | null;
      category: string;
      config: string;
      acceptedObjectTypes: ObjectType[];
      createdAt: number;
      updatedAt: number;
    };
  });

export const deleteOperation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => operationsDao.delete(data.id));
