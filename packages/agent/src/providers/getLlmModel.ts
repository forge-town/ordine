import { createOpenAI } from "@ai-sdk/openai";
import { resolveSettings } from "./resolveSettings";
import { DEFAULT_HEADERS } from "./constants";
import type { SettingsResolver, LlmOverride, LogFn } from "./types";
import { noopLog } from "./types";

export const getLlmModel = async (
  getSettings: SettingsResolver,
  override?: LlmOverride,
  log: LogFn = noopLog,
) => {
  const { provider, model, apiKey, baseURL } = await resolveSettings(getSettings, override);

  await log(
    `[LLM] Provider: ${provider}, Model: ${model}, API key: ${apiKey ? `configured (${apiKey.slice(0, 6)}...)` : "NOT SET"}`,
  );

  if (!apiKey) {
    await log(`[LLM] WARNING: No API key configured — LLM calls will be skipped`);
    return null;
  }

  await log(`[LLM] Base URL: ${baseURL}`);

  const openai = createOpenAI({
    apiKey,
    baseURL,
    headers: DEFAULT_HEADERS,
  });
  return openai.chat(model);
};
