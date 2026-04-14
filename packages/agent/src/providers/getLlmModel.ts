import { createOpenAI } from "@ai-sdk/openai";
import { resolveSettings } from "./resolveSettings";
import { DEFAULT_HEADERS } from "./constants";
import type { SettingsResolver, LlmOverride } from "./types";
import { logger } from "../logger";

export const getLlmModel = async (getSettings: SettingsResolver, override?: LlmOverride) => {
  const { provider, model, apiKey, baseURL } = await resolveSettings(getSettings, override);

  logger.info({ provider, model, apiKeySet: !!apiKey }, "Resolving LLM model");

  if (!apiKey) {
    logger.warn("No API key configured — LLM calls will be skipped");
    return null;
  }

  logger.debug({ baseURL }, "Creating OpenAI-compatible client");

  const openai = createOpenAI({
    apiKey,
    baseURL,
    headers: DEFAULT_HEADERS,
  });
  return openai.chat(model);
};
