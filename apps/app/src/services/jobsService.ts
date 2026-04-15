import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { jobsDao } from "@repo/models";
import { JobStatusSchema, JobTypeSchema } from "@repo/schemas";
import { createJobsService } from "@repo/services";

const service = createJobsService(jobsDao);

export const getJobs = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        status: JobStatusSchema.optional(),
        workId: z.string().optional(),
        projectId: z.string().optional(),
      })
      .optional()
  )
  .handler(({ data }) => service.getAll(data ?? {}));

export const getJobById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const createJob = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      title: z.string(),
      type: JobTypeSchema.default("custom"),
      workId: z.string().nullable().default(null),
      projectId: z.string().nullable().default(null),
      pipelineId: z.string().nullable().default(null),
      logs: z.array(z.string()).default([]),
      result: z
        .object({
          output: z.string().optional(),
          summary: z.string().optional(),
        })
        .nullable()
        .default(null),
      error: z.string().nullable().default(null),
      status: JobStatusSchema.default("queued"),
      startedAt: z.number().nullable().default(null),
      finishedAt: z.number().nullable().default(null),
    })
  )
  .handler(({ data }) => service.create(data));

export const updateJobStatus = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.string(),
      status: JobStatusSchema,
      logs: z.array(z.string()).optional(),
      error: z.string().optional(),
      result: z
        .object({
          output: z.string().optional(),
          summary: z.string().optional(),
        })
        .optional(),
      startedAt: z.number().optional(),
      finishedAt: z.number().optional(),
    })
  )
  .handler(({ data }) => {
    const { id, status, ...extra } = data;
    return service.updateStatus(id, status, extra);
  });

export const deleteJob = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
