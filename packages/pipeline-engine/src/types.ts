import type { LanguageModel } from "ai";
import type { PipelineEdge, OutputMode } from "@repo/db-schema";
import type { OperationEntity } from "@repo/models";
import type { SettingsResolver } from "@repo/agent";
import type { ResultAsync } from "neverthrow";

// ─── executor config (moved from app) ─────────────────────────────────────────

export type ExecutorType = "agent" | "script" | "rule-check";
export type AgentMode = "skill" | "prompt";
export type ScriptLanguage = "bash" | "python" | "javascript";

export interface ExecutorConfig {
  type: ExecutorType;
  agentMode?: AgentMode;
  skillId?: string;
  prompt?: string;
  command?: string;
  language?: ScriptLanguage;
  writeEnabled?: boolean;
}

// ─── node data shapes ─────────────────────────────────────────────────────────

export interface NodeData {
  nodeType?: string;
  folderPath?: string;
  excludedPaths?: string[];
  disclosureMode?: "tree" | "full" | "files-only";
  includedExtensions?: string[];
  filePath?: string;
  localPath?: string;
  operationId?: string;
  outputFileName?: string;
  outputMode?: OutputMode;
}

export interface OperationConfig {
  executor?: ExecutorConfig;
}

export interface NodeCtx {
  inputPath: string;
  content: string;
}

// ─── error types ──────────────────────────────────────────────────────────────

export class PipelineNotFoundError extends Error {
  constructor(public readonly pipelineId: string) {
    super(`Pipeline ${pipelineId} not found`);
    this.name = "PipelineNotFoundError";
  }
}

export class ScriptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ScriptExecutionError";
  }
}

export class ConfigParseError extends Error {
  constructor(
    public readonly operationName: string,
    public readonly cause?: unknown,
  ) {
    super(`Could not parse config for operation ${operationName}`);
    this.name = "ConfigParseError";
  }
}

export class GitCloneError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "GitCloneError";
  }
}

export type PipelineRunError =
  | PipelineNotFoundError
  | ScriptExecutionError
  | ConfigParseError
  | GitCloneError;

// ─── execution context shared across node processors ──────────────────────────

export interface PipelineExecutionCtx {
  jobId: string;
  githubToken?: string;
  nodeOutputs: Map<string, NodeCtx>;
  tempDirs: string[];
  operationsMap: Map<string, OperationEntity>;
  edges: PipelineEdge[];
  log: (line: string) => Promise<void>;
  getSettings: SettingsResolver;
  getModel: (override?: string) => Promise<LanguageModel | null>;
}

// ─── dependency injection: external functions provided by the host app ─────────

export interface RunPromptOptions {
  prompt: string;
  inputContent: string;
  getSettings: SettingsResolver;
  modelOverride?: string;
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
}

export interface RunSkillOptions {
  skillId: string;
  skillDescription: string;
  inputContent: string;
  inputPath: string;
  getSettings: SettingsResolver;
  modelOverride?: string;
  onChunk?: (accumulated: string) => Promise<void>;
  onProgress?: (line: string) => Promise<void>;
  writeEnabled?: boolean;
}

export interface PipelineEngineDeps {
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, never>;
  structuredJsonToMarkdown: (content: string) => string;
}
