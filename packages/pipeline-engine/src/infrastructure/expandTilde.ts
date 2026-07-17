import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Expands a leading `~` to the user's home directory. Node's fs APIs treat `~`
 * as a literal directory name, so every path must be expanded once, up front —
 * the executor, artifact capture, and output nodes all need to see the same
 * real path.
 */
export const expandTilde = (p: string): string =>
  p.startsWith("~/") ? join(homedir(), p.slice(2)) : p === "~" ? homedir() : p;
