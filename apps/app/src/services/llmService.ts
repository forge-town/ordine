/**
 * LLM Service — thin adapter that binds `@repo/agent` to the app's settingsDao.
 *
 * All LLM logic lives in `@repo/agent`. This module re-exports the API
 * with `settingsDao.get()` pre-bound so callers don't need to pass it.
 */

import {
  getLlmModel as getLlmModelRaw,
  getMastraModelConfig as getMastraModelConfigRaw,
  noopLog,
  type LlmOverride,
  type LlmProvider as AgentLlmProvider,
  type LogFn,
  type MastraModelConfig,
  type SettingsResolver,
} from "@repo/agent";
import { settingsDao } from "@/models/daos/settingsDao";
import type { LlmProvider } from "@/models/tables/settings_table";

export type { LlmProvider, LlmOverride, LogFn, MastraModelConfig };
export { noopLog };

const getSettings: SettingsResolver = async () => {
  const s = await settingsDao.get();
  return {
    llmProvider: s.llmProvider as AgentLlmProvider,
    llmModel: s.llmModel,
    llmApiKey: s.llmApiKey,
  };
};

export const getLlmModel = (override?: LlmOverride, log: LogFn = noopLog) =>
  getLlmModelRaw(getSettings, override, log);

export const getMastraModelConfig = (
  override?: LlmOverride,
  log: LogFn = noopLog
): Promise<MastraModelConfig | null> => getMastraModelConfigRaw(getSettings, override, log);
