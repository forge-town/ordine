import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { nativeRustEnvironment, nativeRustTarget } from "./nativeTarget";

const args = process.argv.slice(2);
const command = args[0] ?? "build";
const rest = args.slice(1);
const target = rest.some((value) => value === "--target" || value.startsWith("--target="))
  ? []
  : ["--target", nativeRustTarget()];
execFileSync(
  process.execPath,
  [
    fileURLToPath(new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url)),
    command,
    ...target,
    ...rest,
  ],
  {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: nativeRustEnvironment(),
    stdio: "inherit",
    windowsHide: true,
  },
);
