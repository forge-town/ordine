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

export type SettingsResolver = () => Promise<LlmSettings>;
