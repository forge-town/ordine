import type { CapabilityRiskTier } from "@repo/schemas";

const READONLY_KEYWORDS = new Set([
  "get",
  "list",
  "read",
  "query",
  "search",
  "find",
  "fetch",
  "view",
  "inspect",
  "describe",
  "preview",
  "check",
  "status",
]);

const WRITE_KEYWORDS = new Set([
  "create",
  "add",
  "update",
  "modify",
  "edit",
  "write",
  "set",
  "upsert",
  "patch",
  "upload",
  "import",
  "copy",
  "move",
  "connect",
  "disconnect",
  "archive",
  "restore",
]);

const IRREVERSIBLE_KEYWORDS = new Set([
  "publish",
  "delete",
  "remove",
  "destroy",
  "drop",
  "pay",
  "charge",
  "refund",
  "transfer",
  "send",
  "deploy",
  "release",
  "execute",
]);

export const tokenizeCapabilityName = (value: string): string[] =>
  value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

export const inferCapabilityRiskTier = (value: string): CapabilityRiskTier => {
  const tokens = tokenizeCapabilityName(value);

  if (tokens.some((token) => IRREVERSIBLE_KEYWORDS.has(token))) return "irreversible";
  if (tokens.some((token) => WRITE_KEYWORDS.has(token))) return "write";
  if (tokens.some((token) => READONLY_KEYWORDS.has(token))) return "readonly";

  return "write";
};
