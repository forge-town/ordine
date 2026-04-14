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

export type SettingsResolver = () => Promise<LlmSettings>;
