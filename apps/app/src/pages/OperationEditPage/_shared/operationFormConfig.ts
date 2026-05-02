import { FileCode, Folder, FolderGit2, Puzzle, Terminal, Wand2 } from "lucide-react";
import type { ObjectType } from "@repo/schemas";

export const EXECUTOR_ICONS = {
  agent: Wand2,
  script: Terminal,
} as const satisfies Record<string, React.ElementType>;

export const AGENT_MODE_ICONS = {
  skill: Puzzle,
  prompt: Wand2,
} as const satisfies Record<string, React.ElementType>;

export const OBJECT_TYPE_ICONS: Record<ObjectType, React.ElementType> = {
  file: FileCode,
  folder: Folder,
  project: FolderGit2,
};
