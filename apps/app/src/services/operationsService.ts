import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { operationsDao } from "@repo/models";
import { ObjectTypeSchema as ObjectTypeEnum } from "@repo/schemas";
import { createOperationsService } from "@repo/services";

const service = createOperationsService(operationsDao);

export const getOperations = createServerFn({ method: "GET" }).handler(() => service.getAll());

export const getOperationById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

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
  .handler(({ data }) => service.create(data));

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
  .handler(({ data }) => {
    const { id, ...rest } = data;
    return service.update(id, rest);
  });

export const deleteOperation = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
