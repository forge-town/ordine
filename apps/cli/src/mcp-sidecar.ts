#!/usr/bin/env node
import { McpPolicyModeSchema } from "./mcp/policy";
import { startMcpServer } from "./mcp/server";

const readOption = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);

  return index >= 0 ? process.argv[index + 1] : undefined;
};

await startMcpServer({
  mode: McpPolicyModeSchema.parse(readOption("--policy") ?? "safe"),
  allowWrite: process.argv.includes("--allow-write"),
  allowIrreversible: process.argv.includes("--allow-irreversible"),
});
