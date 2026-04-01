import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { worksDao } from "@/models/daos/worksDao";

const WorkObjectSchema = z.object({
  type: z.enum(["file", "folder", "project"]),
  path: z.string(),
});

export const getWorks = createServerFn({ method: "GET" }).handler(() =>
  worksDao.findMany(),
);

export const getWorksByProject = createServerFn({ method: "GET" })
  .inputValidator(z.object({ projectId: z.string() }))
  .handler(async ({ data }) => worksDao.findByProject(data.projectId));

export const getWorkById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => worksDao.findById(data.id));

export const createWork = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      projectId: z.string(),
      pipelineId: z.string(),
      pipelineName: z.string(),
      object: WorkObjectSchema,
    }),
  )
  .handler(async ({ data }) =>
    worksDao.create({ ...data, status: "pending", logs: [] }),
  );

export const updateWorkStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      status: z.enum(["pending", "running", "success", "failed"]),
    }),
  )
  .handler(async ({ data }) => worksDao.updateStatus(data.id, data.status));

export const deleteWork = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data }) => worksDao.delete(data.id));
