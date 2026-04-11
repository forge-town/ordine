import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { jobsDao } from "@/models/daos/jobsDao";
import { JobStatusSchema, JobTypeSchema } from "@/schemas";

export const jobsRouter = router({
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => jobsDao.findById(input.id)),

  create: publicProcedure
    .input(
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
      }),
    )
    .mutation(({ input }) => jobsDao.create(input)),

  updateStatus: publicProcedure
    .input(
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
      }),
    )
    .mutation(({ input }) => {
      const { id, status, ...extra } = input;
      return jobsDao.updateStatus(id, status, extra);
    }),
});
