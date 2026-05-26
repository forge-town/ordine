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
  .action(async (opts: { yes: boolean }) => {
    const result = await onboard({ nonInteractive: opts.yes });

    if (result.isErr()) {
      console.error(result.error.message);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
