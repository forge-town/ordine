import { z } from "zod/v4";

export const ToolNameSchema = z.enum([
  // Read-only filesystem tools
  "Read",
  "Bash(find:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(cat:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
  "Bash(ls:*)",
  "Bash(tree:*)",
  // Write tools
  "Edit",
  "Write",
  "Bash(sed:*)",
  // Web tools
  "Bash(curl:*)",
  "Bash(python3:*)",
  "WebSearch",
  "WebFetch",
  // GitHub CLI tools
  "Bash(gh:*)",
]);

export type ToolName = z.infer<typeof ToolNameSchema>;
