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

  getAgentRuns: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => jobsService.getAgentRunsByJobId(input.jobId)),

  getAgentRunSpans: publicProcedure
    .input(z.object({ rawExportId: z.number() }))
    .query(({ input }) => jobsService.getSpansByRawExportId(input.rawExportId)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string(),
        type: JobTypeSchema,
        parentJobId: z.string().nullable().default(null),
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
        error: z.string().optional(),
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
