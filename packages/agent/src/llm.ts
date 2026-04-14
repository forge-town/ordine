/**
 * LLM Service — centralised provider/model resolution.
 *
 * Provides AI-SDK LanguageModel and Mastra model config from
 * runtime settings. Settings are injected via `LlmSettings` to
 * keep this package independent of any specific DAO.
 *
 * Uses `@ai-sdk/openai .chat()` for `streamText` calls (Kimi Coding
 * API only supports the Chat Completions path with streaming).
 * Uses Mastra model-router format for Agent instances.
 *
 * @see https://mastra.ai/models/providers/kimi-for-coding
 */

import { createOpenAI } from "@ai-sdk/openai";

// ─── constants ────────────────────────────────────────────────────────────────

const PROVIDER_BASE_URLS: Record<string, string> = {
  kimi: "https://api.kimi.com/coding/v1",
  deepseek: "https://api.deepseek.com/v1",
};

const PROVIDER_MASTRA_PREFIX: Record<string, string> = {
  kimi: "kimi-for-coding",
  deepseek: "deepseek",
};

const DEFAULT_HEADERS = { "User-Agent": "claude-code/1.0" };

// ─── public types ─────────────────────────────────────────────────────────────

export type LlmProvider = "kimi" | "deepseek";

export interface LlmSettings {
  llmProvider: LlmProvider;
  llmApiKey: string;
  llmModel: string;
}

export interface LlmOverride {
  llmProvider?: LlmProvider;
  llmModel?: string;
}

export type LogFn = (msg: string) => Promise<void>;
export const noopLog: LogFn = async () => {};

export interface MastraModelConfig {
  id: `${string}/${string}`;
  url: string;
  apiKey: string;
  headers: Record<string, string>;
}

// ─── settings resolver ─────────────────────────────────────────────────────────

export type SettingsResolver = () => Promise<LlmSettings>;

const resolveSettings = async (getSettings: SettingsResolver, override?: LlmOverride) => {
  const settings = await getSettings();
  const provider = override?.llmProvider ?? settings.llmProvider;
  const model = override?.llmModel ?? settings.llmModel;
  const apiKey = settings.llmApiKey;
  const baseURL = (PROVIDER_BASE_URLS[provider] ?? PROVIDER_BASE_URLS.kimi) as string;
  return { provider, model, apiKey, baseURL };
};

// ─── public API ───────────────────────────────────────────────────────────────

/**
 * Returns an AI-SDK LanguageModel that calls the Chat Completions endpoint.
 *
 * Use with `streamText({ model, ... })` from the `ai` package.
 */
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

/**
 * Returns a Mastra-compatible model config object for `new Agent({ model })`.
 */
export const getMastraModelConfig = async (
  getSettings: SettingsResolver,
  override?: LlmOverride,
  log: LogFn = noopLog,
): Promise<MastraModelConfig | null> => {
  const { provider, model, apiKey, baseURL } = await resolveSettings(getSettings, override);

  if (!apiKey) {
    await log(`[Mastra] No API key configured — agent calls will be skipped`);
    return null;
  }

  const prefix = PROVIDER_MASTRA_PREFIX[provider] ?? "kimi-for-coding";
  const modelId = `${prefix}/${model}` as const;
  await log(`[Mastra] Model: ${modelId}, URL: ${baseURL}`);

  return {
    id: modelId as `${string}/${string}`,
    url: baseURL,
    apiKey,
    headers: DEFAULT_HEADERS,
  };
};
