#!/usr/bin/env node
import { Command } from "commander";
import { createRequire } from "node:module";
import { onboard } from "./onboard";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

const program = new Command();

program
  .name("create-ordine")
  .description("Create a local Ordine instance")
  .version(version)
  .option("-y, --yes", "Non-interactive mode, use defaults", false)
  .action((opts: { yes: boolean }) => onboard({ nonInteractive: opts.yes }));

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
