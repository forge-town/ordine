import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { settingsService } from "../services";
import { AgentRuntimeSchema } from "@repo/schemas";

const UpdateSettingsSchema = z.object({
  defaultAgentRuntime: AgentRuntimeSchema.optional(),
  defaultApiKey: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const settingsRouter = router({
  get: publicProcedure.query(() => settingsService.get()),

  update: publicProcedure
    .input(UpdateSettingsSchema)
    .mutation(({ input }) => settingsService.update(input)),
});
