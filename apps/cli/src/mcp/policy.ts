import { z } from "zod";

export const McpPolicyModeSchema = z.enum(["safe", "yolo"]);
export type McpPolicyMode = z.infer<typeof McpPolicyModeSchema>;

export const McpToolRiskSchema = z.enum(["read", "draft", "write", "execute", "irreversible"]);
export type McpToolRisk = z.infer<typeof McpToolRiskSchema>;

export type McpPolicy = {
  mode: McpPolicyMode;
  allowWrite: boolean;
  allowIrreversible: boolean;
};

export const canCallMcpTool = (policy: McpPolicy, risk: McpToolRisk): boolean => {
  if (policy.mode === "yolo") return true;
  if (risk === "read") return true;
  if (risk === "draft" || risk === "write" || risk === "execute") return policy.allowWrite;

  return policy.allowIrreversible;
};

export const describeMcpPolicyDenial = (policy: McpPolicy, risk: McpToolRisk): string => {
  if (risk === "draft" || risk === "write" || risk === "execute") {
    return "Safe MCP policy blocked this write tool. Restart with --allow-write or --policy yolo.";
  }
  if (risk === "irreversible") {
    return "Safe MCP policy blocked this irreversible tool. Restart with --allow-irreversible or --policy yolo.";
  }

  return `MCP policy ${policy.mode} blocked this tool.`;
};
