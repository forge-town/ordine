export type {
  PortKind,
  InputPort,
  OutputPort,
  ExecutorConfig,
  OperationConfig,
} from "@repo/schemas";
import type { PortKind } from "@repo/schemas";

export const KIND_LABEL: Record<PortKind, string> = {
  text: "text",
  file: "file",
  folder: "folder",
  project: "project",
};
