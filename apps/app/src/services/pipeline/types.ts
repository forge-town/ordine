import type { LanguageModel } from "ai";
import type { PipelineEdge, OutputMode } from "@repo/db-schema";
import type { OperationEntity } from "@repo/models";
import type { SettingsResolver } from "@repo/agent";
import type { ExecutorConfig } from "@/pages/OperationDetailPage/types";

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
