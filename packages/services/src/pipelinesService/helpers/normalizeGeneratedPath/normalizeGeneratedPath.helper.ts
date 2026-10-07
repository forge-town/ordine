import "../../../text-imports.d.ts";

import { win32 } from "node:path";

import { expandTilde } from "../expandTilde";

export const normalizeGeneratedPath = (path: string): string => {
  const expanded = expandTilde(path);
  if (process.platform !== "win32") {
    return expanded;
  }

  const withoutPosixDrivePrefix = /^\/[a-zA-Z]:[\\/]/.test(expanded) ? expanded.slice(1) : expanded;

  return /^[a-zA-Z]:[\\/]/.test(withoutPosixDrivePrefix)
    ? win32.normalize(withoutPosixDrivePrefix)
    : withoutPosixDrivePrefix;
};
