export type {
  PortKind,
  InputPort,
  OutputPort,
  ExecutorConfig,
  OperationConfig,
} from "@repo/pipeline-engine/schemas";
import type { PortKind } from "@repo/pipeline-engine/schemas";

export const KIND_LABEL: Record<PortKind, string> = {
  text: "text",
  file: "file",
  folder: "folder",
  project: "project",
};
