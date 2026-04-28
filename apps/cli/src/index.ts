#!/usr/bin/env node
import { Command } from "commander";
import packageJson from "../package.json";
import {
  listPipelines,
  getPipeline,
  createPipeline,
  updatePipeline,
  deletePipeline,
  runPipeline,
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
  listOperations,
  getOperation,
  createOperation,
  updateOperation,
  deleteOperation,
  listJobs,
  getJob,
  deleteJob,
  listRecipes,
  createRecipe,
  deleteRecipe,
  listBestPractices,
  getBestPractice,
  createBestPractice,
  updateBestPractice,
  deleteBestPractice,
  exportBestPractices,
  importBestPractices,
  browseFilesystem,
} from "./commands";

const program = new Command();

program
  .name("ordine")
  .description("Ordine CLI — manage pipelines, rules, skills, and more")
  .version(packageJson.version);

// ─── Pipelines ───────────────────────────────────────────────────────

const pipelinesCmd = program.command("pipelines").description("Manage pipelines");
pipelinesCmd
  .command("list")
  .alias("ls")
  .description("List all pipelines")
  .action(() => listPipelines());
pipelinesCmd
  .command("get <id>")
  .description("Get pipeline details")
  .action((id: string) => getPipeline(id));
pipelinesCmd
  .command("create <jsonFile>")
  .description("Create a pipeline from JSON file")
  .action((f: string) => createPipeline(f));
pipelinesCmd
  .command("update <id> <jsonFile>")
  .description("Update a pipeline")
  .action((id: string, f: string) => updatePipeline(id, f));
pipelinesCmd
  .command("delete <id>")
  .description("Delete a pipeline")
  .action((id: string) => deletePipeline(id));

program
  .command("run <pipelineId>")
  .description("Run a pipeline by ID")
  .option("-i, --input <path>", "Input file or folder path")
  .option("--no-follow", "Do not follow job progress (fire and forget)")
  .action((pipelineId: string, opts: { input?: string; follow?: boolean }) =>
    runPipeline(pipelineId, { inputPath: opts.input, follow: opts.follow }),
  );

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

// ─── Operations ──────────────────────────────────────────────────────

const opsCmd = program.command("operations").alias("ops").description("Manage operations");
opsCmd
  .command("list")
  .alias("ls")
  .description("List all operations")
  .action(() => listOperations());
opsCmd
  .command("get <id>")
  .description("Get operation details")
  .action((id: string) => getOperation(id));
opsCmd
  .command("create <jsonFile>")
  .description("Create an operation from JSON file")
  .action((f: string) => createOperation(f));
opsCmd
  .command("update <id> <jsonFile>")
  .description("Update an operation")
  .action((id: string, f: string) => updateOperation(id, f));
opsCmd
  .command("delete <id>")
  .description("Delete an operation")
  .action((id: string) => deleteOperation(id));

// ─── Jobs ────────────────────────────────────────────────────────────

const jobsCmd = program.command("jobs").description("Manage jobs");
jobsCmd
  .command("list")
  .alias("ls")
  .description("List all jobs")
  .option("-s, --status <status>", "Filter by status")
  .action((opts: { status?: string }) => listJobs(opts));
jobsCmd
  .command("get <id>")
  .description("Get job details")
  .action((id: string) => getJob(id));
jobsCmd
  .command("delete <id>")
  .description("Delete a job")
  .action((id: string) => deleteJob(id));

// ─── Recipes ─────────────────────────────────────────────────────────

const recipesCmd = program.command("recipes").description("Manage recipes");
recipesCmd
  .command("list")
  .alias("ls")
  .description("List all recipes")
  .action(() => listRecipes());
recipesCmd
  .command("create <jsonFile>")
  .description("Create a recipe from JSON file")
  .action((f: string) => createRecipe(f));
recipesCmd
  .command("delete <id>")
  .description("Delete a recipe")
  .action((id: string) => deleteRecipe(id));

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

// ─── Parse ───────────────────────────────────────────────────────────

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  // eslint-disable-next-line unicorn/no-process-exit -- CLI entry point
  process.exit(1);
});
