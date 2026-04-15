import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { settingsDao } from "@repo/models";
import { LLM_PROVIDERS } from "@repo/db-schema";

const UpdateSettingsSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDERS).optional(),
  llmApiKey: z.string().optional(),
  llmModel: z.string().optional(),
});

export const settingsRouter = router({
  get: publicProcedure.query(() => settingsDao.get()),

  update: publicProcedure
    .input(UpdateSettingsSchema)
    .mutation(({ input }) => settingsDao.update(input)),
});
