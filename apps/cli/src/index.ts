#!/usr/bin/env bun
import { Command } from "commander";
import { listPipelines, runPipeline } from "./commands.js";

const program = new Command();

program
  .name("ordine")
  .description("Ordine CLI — run pipelines from the command line")
  .version("0.0.0");

program
  .command("pipelines")
  .alias("ls")
  .description("List all pipelines")
  .action(() => listPipelines());

program
  .command("run <pipelineId>")
  .description("Run a pipeline by ID")
  .option("-i, --input <path>", "Input file or folder path")
  .option("--no-follow", "Do not follow job progress (fire and forget)")
  .action((pipelineId: string, opts: { input?: string; follow?: boolean }) =>
    runPipeline(pipelineId, { inputPath: opts.input, follow: opts.follow }),
  );

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  // eslint-disable-next-line unicorn/no-process-exit -- CLI entry point
  process.exit(1);
});
