import { Hono, type Context } from "hono";
import { z } from "zod/v4";
import { usageService } from "../services.js";
import { resultJson, validationErrorJson } from "./result.js";

export const usageRoutes = new Hono();

const rangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const parseRange = (c: Context) =>
  rangeQuerySchema.safeParse({
    from: c.req.query("from"),
    to: c.req.query("to"),
  });

usageRoutes.get("/summary", async (c) => {
  const parsed = parseRange(c);
  if (!parsed.success) return validationErrorJson(c);

  const result = await usageService.getSummary(parsed.data);

  return resultJson(c, result);
});

usageRoutes.get("/daily-token-series", async (c) => {
  const parsed = parseRange(c);
  if (!parsed.success) return validationErrorJson(c);

  const result = await usageService.getDailyTokenSeries(parsed.data);

  return resultJson(c, result);
});

usageRoutes.get("/by-pipeline", async (c) => {
  const parsed = parseRange(c);
  if (!parsed.success) return validationErrorJson(c);

  const result = await usageService.getByPipeline(parsed.data);

  return resultJson(c, result);
});

usageRoutes.get("/by-agent", async (c) => {
  const parsed = parseRange(c);
  if (!parsed.success) return validationErrorJson(c);

  const result = await usageService.getByAgent(parsed.data);

  return resultJson(c, result);
});
