/**
 * LLM Service — thin adapter that binds `@repo/agent` to the app's settingsDao.
 *
 * All LLM logic lives in `@repo/agent`. This module re-exports the API
 * with `settingsDao.get()` pre-bound so callers don't need to pass it.
 */

import type { MastraModelConfig } from "@mastra/core/llm";
import {
  getLlmModel as getLlmModelRaw,
  getMastraModelConfig as getMastraModelConfigRaw,
  type LlmOverride,
  type LlmProvider as AgentLlmProvider,
  type SettingsResolver,
} from "@repo/agent";
import { settingsDao } from "@/models/daos/settingsDao";
import type { LlmProvider } from "@/models/tables/settings_table";

export type { LlmProvider, LlmOverride, MastraModelConfig };

const getSettings: SettingsResolver = async () => {
  const s = await settingsDao.get();
  return {
    llmProvider: s.llmProvider as AgentLlmProvider,
    llmModel: s.llmModel,
    llmApiKey: s.llmApiKey,
  };
};

export const getLlmModel = (override?: LlmOverride) => getLlmModelRaw(getSettings, override);

export const getMastraModelConfig = (override?: LlmOverride): Promise<MastraModelConfig | null> =>
  getMastraModelConfigRaw(getSettings, override);
