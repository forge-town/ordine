import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { delimiter, resolve } from "node:path";

export const nativeRustEnvironment = () => {
  const rustBin = resolve(process.env.CARGO_HOME ?? resolve(homedir(), ".cargo"), "bin");
  // Windows may expose Path instead of PATH; passing both makes child lookup ambiguous.
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.toLowerCase() !== "path"),
  );

  return {
    ...environment,
    PATH: [rustBin, process.env.PATH ?? process.env.Path ?? ""].join(delimiter),
  };
};

export const nativeRustTarget = (): string => {
  const rustc = resolve(
    process.env.CARGO_HOME ?? resolve(homedir(), ".cargo"),
    "bin",
    process.platform === "win32" ? "rustc.exe" : "rustc",
  );
  const target =
    process.env.TAURI_ENV_TARGET_TRIPLE ??
    execFileSync(existsSync(rustc) ? rustc : "rustc", ["-vV"], {
      encoding: "utf8",
      windowsHide: true,
    })
      .split(/\r?\n/)
      .find((line) => line.startsWith("host: "))
      ?.slice(6);
  if (!target || !/^[a-z0-9_-]+$/.test(target))
    throw new Error("Rust target triple could not be determined.");

  return target;
};
