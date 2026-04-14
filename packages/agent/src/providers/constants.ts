export const PROVIDER_BASE_URLS: Record<string, string> = {
  kimi: "https://api.kimi.com/coding/v1",
  deepseek: "https://api.deepseek.com/v1",
};

export const PROVIDER_MASTRA_PREFIX: Record<string, string> = {
  kimi: "kimi-for-coding",
  deepseek: "deepseek",
};

export const DEFAULT_HEADERS = { "User-Agent": "claude-code/1.0" };
