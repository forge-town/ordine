import "../../../text-imports.d.ts";
import { homedir } from "node:os";
import { join } from "node:path";

export const expandTilde = (p: string): string =>
  p.startsWith("~/") ? join(homedir(), p.slice(2)) : p === "~" ? homedir() : p;
