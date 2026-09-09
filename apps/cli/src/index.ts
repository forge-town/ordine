#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json";
import {
  listRules,
  getRule,
  createRule,
  updateRule,
  deleteRule,
  listSkills,
  getSkill,
  createSkill,
  updateSkill,
  deleteSkill,
  listBestPractices,
  getBestPractice,
  createBestPractice,
  updateBestPractice,
  deleteBestPractice,
  exportBestPractices,
  importBestPractices,
  browseFilesystem,
} from "./commands";
import { registerExecutionCommands } from "./executionCommands";
import { startDaemon } from "./daemon";
import { registerAgentSetupCommands, registerMcpCommands } from "./mcp/cliCommands";

const program = new Command();

program
  .name("ordine")
  .description("Ordine CLI — manage pipelines, rules, skills, and more")
  .option("--json", "Print machine-readable JSON for supported commands")
  .version(packageJson.version);

const outputOptions = (): { json?: boolean } => program.opts<{ json?: boolean }>();

// ─── MCP / Runtime Compatibility ────────────────────────────────────

registerExecutionCommands(program);
registerMcpCommands(program, outputOptions);
registerAgentSetupCommands(program);

// ─── Rules ───────────────────────────────────────────────────────────

const rulesCmd = program.command("rules").description("Manage rules");
rulesCmd
  .command("list")
  .alias("ls")
  .description("List all rules")
  .action(() => listRules());
rulesCmd
  .command("get <id>")
  .description("Get rule details")
  .action((id: string) => getRule(id));
rulesCmd
  .command("create <jsonFile>")
  .description("Create a rule from JSON file")
  .action((f: string) => createRule(f));
rulesCmd
  .command("update <id> <jsonFile>")
  .description("Update a rule")
  .action((id: string, f: string) => updateRule(id, f));
rulesCmd
  .command("delete <id>")
  .description("Delete a rule")
  .action((id: string) => deleteRule(id));

// ─── Skills ──────────────────────────────────────────────────────────

const skillsCmd = program.command("skills").description("Manage skills");
skillsCmd
  .command("list")
  .alias("ls")
  .description("List all skills")
  .action(() => listSkills());
skillsCmd
  .command("get <id>")
  .description("Get skill details")
  .action((id: string) => getSkill(id));
skillsCmd
  .command("create <jsonFile>")
  .description("Create a skill from JSON file")
  .action((f: string) => createSkill(f));
skillsCmd
  .command("update <id> <jsonFile>")
  .description("Update a skill")
  .action((id: string, f: string) => updateSkill(id, f));
skillsCmd
  .command("delete <id>")
  .description("Delete a skill")
  .action((id: string) => deleteSkill(id));

// ─── Best Practices ──────────────────────────────────────────────────

const bpCmd = program.command("best-practices").alias("bp").description("Manage best practices");
bpCmd
  .command("list")
  .alias("ls")
  .description("List all best practices")
  .action(() => listBestPractices());
bpCmd
  .command("get <id>")
  .description("Get best practice details")
  .action((id: string) => getBestPractice(id));
bpCmd
  .command("create <jsonFile>")
  .description("Create a best practice from JSON file")
  .action((f: string) => createBestPractice(f));
bpCmd
  .command("update <id> <jsonFile>")
  .description("Update a best practice")
  .action((id: string, f: string) => updateBestPractice(id, f));
bpCmd
  .command("delete <id>")
  .description("Delete a best practice")
  .action((id: string) => deleteBestPractice(id));
bpCmd
  .command("export <outFile>")
  .description("Export all best practices as .bestpractice file")
  .action((f: string) => exportBestPractices(f));
bpCmd
  .command("import <jsonFile>")
  .description("Import best practices from JSON file")
  .action((f: string) => importBestPractices(f));

// ─── Filesystem ──────────────────────────────────────────────────────

const fsCmd = program.command("fs").description("Browse filesystem");
fsCmd
  .command("browse [path]")
  .description("List directory contents")
  .action((p?: string) => browseFilesystem(p));

// ─── Daemon ──────────────────────────────────────────────────────────

program
  .command("daemon")
  .description("Run daemon to scan local runtimes and sync with server")
  .option("--once", "Scan once and exit (no heartbeat loop)")
  .option("--interval <ms>", "Heartbeat interval in milliseconds", "15000")
  .action((opts: { once?: boolean; interval?: string }) =>
    startDaemon({ once: opts.once, interval: Number(opts.interval) }),
  );

// ─── Parse ───────────────────────────────────────────────────────────

void program.parseAsync().then(
  () => undefined,
  (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    // eslint-disable-next-line unicorn/no-process-exit -- CLI entry point
    process.exit(1);
  },
);
