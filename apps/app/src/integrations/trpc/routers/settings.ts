import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { settingsService } from "../services";
import { AgentRuntimePreferencesSchema, DefaultAgentRuntimeSchema } from "@repo/schemas";

const UpdateSettingsSchema = z.object({
  defaultAgentRuntime: DefaultAgentRuntimeSchema.optional(),
  defaultAgentRuntimeConfigId: z.string().min(1).nullable().optional(),
  agentRuntimePreferences: AgentRuntimePreferencesSchema.optional(),
  defaultApiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultOutputPath: z.string().optional(),
});

export const settingsRouter = router({
  get: publicProcedure.query(() => settingsService.get()),

  update: publicProcedure
    .input(UpdateSettingsSchema)
    .mutation(({ input }) => settingsService.update(input)),
});
