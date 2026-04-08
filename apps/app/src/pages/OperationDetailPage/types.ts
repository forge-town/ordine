export type PortKind = "text" | "file" | "folder" | "project";

export interface InputPort {
  name: string;
  kind: PortKind;
  required: boolean;
  description: string;
}

export interface OutputPort {
  name: string;
  kind: PortKind;
  path: string;
  description: string;
}

export type ExecutorType = "skill" | "prompt" | "script";
export type ScriptLanguage = "bash" | "python" | "javascript";

export interface ExecutorConfig {
  type: ExecutorType;
  skillId?: string;
  prompt?: string;
  command?: string;
  language?: ScriptLanguage;
}

export interface OperationConfig {
  executor?: ExecutorConfig;
  inputs: InputPort[];
  outputs: OutputPort[];
}

export const KIND_LABEL: Record<PortKind, string> = {
  text: "text",
  file: "file",
  folder: "folder",
  project: "project",
};
