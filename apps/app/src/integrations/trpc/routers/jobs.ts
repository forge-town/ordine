import { legacyExecutionDisabled } from "./legacyExecutionDisabled";
import { z } from "zod/v4";
import { authedProcedure, publicProcedure, router } from "../init";
import { jobsService } from "../services";

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

  create: publicProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),
  updateStatus: publicProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),
  pause: authedProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),
  resume: authedProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),
  cancel: authedProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),
});
