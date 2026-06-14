import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { usageService } from "../services";
import { unwrapResult } from "./result";

const rangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const usageRouter = router({
  getSummary: publicProcedure
    .input(rangeSchema)
    .query(async ({ input }) => unwrapResult(await usageService.getSummary(input))),

  getDailyCostSeries: publicProcedure
    .input(rangeSchema)
    .query(async ({ input }) => unwrapResult(await usageService.getDailyCostSeries(input))),

  getByPipeline: publicProcedure
    .input(rangeSchema)
    .query(async ({ input }) => unwrapResult(await usageService.getByPipeline(input))),

  getByAgent: publicProcedure
    .input(rangeSchema)
    .query(async ({ input }) => unwrapResult(await usageService.getByAgent(input))),
});
