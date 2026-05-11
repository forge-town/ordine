import type { BuiltinNodeType } from "@repo/schemas";
import type { TFunction } from "i18next";

const nodeTypeI18nKeys = {
  operation: {
    label: "canvas.nodeTypes.operation.label",
    shortLabel: "canvas.nodeTypes.operation.shortLabel",
  },
  file: {
    label: "canvas.nodeTypes.file.label",
    shortLabel: "canvas.nodeTypes.file.shortLabel",
  },
  folder: {
    label: "canvas.nodeTypes.folder.label",
    shortLabel: "canvas.nodeTypes.folder.shortLabel",
  },
  "github-project": {
    label: "canvas.nodeTypes.github-project.label",
    shortLabel: "canvas.nodeTypes.github-project.shortLabel",
  },
  "output-project-path": {
    label: "canvas.nodeTypes.output-project-path.label",
    shortLabel: "canvas.nodeTypes.output-project-path.shortLabel",
  },
  "output-local-path": {
    label: "canvas.nodeTypes.output-local-path.label",
    shortLabel: "canvas.nodeTypes.output-local-path.shortLabel",
  },
  compound: {
    label: "canvas.nodeTypes.compound.label",
    shortLabel: "canvas.nodeTypes.compound.shortLabel",
  },
  prompt: {
    label: "canvas.nodeTypes.prompt.label",
    shortLabel: "canvas.nodeTypes.prompt.shortLabel",
  },
} as const satisfies Record<BuiltinNodeType, { label: string; shortLabel: string }>;

export const nodeTypeMeta = {
  operation: {
    label: "Operation",
    shortLabel: "OP",
    border: "border-violet-200",
    selectedBorder: "border-violet-500",
    header: "bg-violet-50",
    headerText: "text-violet-700",
    iconBg: "bg-violet-500",
    handle: "!border-violet-400",
    plusBg: "bg-violet-100 text-violet-700 hover:bg-violet-200",
  },
  file: {
    label: "Code file",
    shortLabel: "File",
    border: "border-orange-200",
    selectedBorder: "border-orange-500",
    header: "bg-orange-50",
    headerText: "text-orange-700",
    iconBg: "bg-orange-500",
    handle: "!border-orange-400",
    plusBg: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  folder: {
    label: "Folder",
    shortLabel: "Folder",
    border: "border-orange-200",
    selectedBorder: "border-orange-500",
    header: "bg-orange-50",
    headerText: "text-orange-700",
    iconBg: "bg-orange-400",
    handle: "!border-orange-400",
    plusBg: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  "github-project": {
    label: "GitHub project",
    shortLabel: "GitHub",
    border: "border-orange-200",
    selectedBorder: "border-orange-500",
    header: "bg-orange-50",
    headerText: "text-orange-700",
    iconBg: "bg-orange-600",
    handle: "!border-orange-400",
    plusBg: "bg-orange-100 text-orange-700 hover:bg-orange-200",
  },
  "output-project-path": {
    label: "Project output",
    shortLabel: "Output",
    border: "border-teal-200",
    selectedBorder: "border-teal-500",
    header: "bg-teal-50",
    headerText: "text-teal-700",
    iconBg: "bg-teal-500",
    handle: "!border-teal-400",
    plusBg: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  },
  "output-local-path": {
    label: "Local output",
    shortLabel: "Local",
    border: "border-teal-200",
    selectedBorder: "border-teal-500",
    header: "bg-teal-50",
    headerText: "text-teal-700",
    iconBg: "bg-teal-600",
    handle: "!border-teal-400",
    plusBg: "bg-teal-100 text-teal-700 hover:bg-teal-200",
  },
  compound: {
    label: "Compound node",
    shortLabel: "Group",
    border: "border-indigo-200",
    selectedBorder: "border-indigo-500",
    header: "bg-indigo-50",
    headerText: "text-indigo-700",
    iconBg: "bg-indigo-500",
    handle: "!border-indigo-400",
    plusBg: "bg-indigo-100 text-indigo-700 hover:bg-indigo-200",
  },
  prompt: {
    label: "提示词",
    shortLabel: "提示",
    border: "border-sky-200",
    selectedBorder: "border-sky-500",
    header: "bg-sky-50",
    headerText: "text-sky-700",
    iconBg: "bg-sky-500",
    handle: "!border-sky-400",
    plusBg: "bg-sky-100 text-sky-700 hover:bg-sky-200",
  },
} as const satisfies Record<BuiltinNodeType, object>;

type NodeMetaEntry = (typeof nodeTypeMeta)[BuiltinNodeType];

/** Safe lookup — returns meta for known types, undefined for plugin types */
export const getNodeMeta = (type: string): NodeMetaEntry | undefined =>
  nodeTypeMeta[type as BuiltinNodeType] as NodeMetaEntry | undefined;

export const getNodeTypeLabel = (t: TFunction, type: string): string => {
  const meta = getNodeMeta(type);
  const keys = nodeTypeI18nKeys[type as BuiltinNodeType];

  return keys ? t(keys.label, { defaultValue: meta?.label ?? type }) : (meta?.label ?? type);
};

export const getNodeTypeShortLabel = (t: TFunction, type: string): string => {
  const meta = getNodeMeta(type);
  const keys = nodeTypeI18nKeys[type as BuiltinNodeType];

  return keys
    ? t(keys.shortLabel, { defaultValue: meta?.shortLabel ?? type })
    : (meta?.shortLabel ?? type);
};
