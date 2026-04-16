import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { jobsService } from "../services";
import { JobStatusSchema, JobTypeSchema } from "@repo/schemas";

export const jobsRouter = router({
  getMany: publicProcedure.query(() => jobsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => jobsService.getById(input.id)),

  getTraces: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => jobsService.getTracesByJobId(input.jobId)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string(),
        type: JobTypeSchema.default("custom"),
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
        startedAt: z
          .number()
          .nullable()
          .default(null)
          .transform((v) => (v == null ? null : new Date(v))),
        finishedAt: z
          .number()
          .nullable()
          .default(null)
          .transform((v) => (v == null ? null : new Date(v))),
      })
    )
    .mutation(({ input }) => jobsService.create(input)),

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
        startedAt: z
          .number()
          .optional()
          .transform((v) => (v == null ? undefined : new Date(v))),
        finishedAt: z
          .number()
          .optional()
          .transform((v) => (v == null ? undefined : new Date(v))),
      })
    )
    .mutation(({ input }) => {
      const { id, status, ...extra } = input;

      return jobsService.updateStatus(id, status, extra);
    }),
});
