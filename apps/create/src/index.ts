#!/usr/bin/env node
import { Command } from "commander";
import { onboard } from "./onboard";

const program = new Command();

program
  .name("create-ordine")
  .description("Create a local Ordine instance")
  .version("0.0.2-preview.4")
  .option("-y, --yes", "Non-interactive mode, use defaults", false)
  .action((opts: { yes: boolean }) => onboard({ nonInteractive: opts.yes }));

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
