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

export interface OperationConfig {
  inputs: InputPort[];
  outputs: OutputPort[];
}

export const KIND_LABEL: Record<PortKind, string> = {
  text: "text",
  file: "file",
  folder: "folder",
  project: "project",
};
