import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from "node:child_process";

/**
 * Spawn a runtime command in a platform-aware way.
 *
 * On Windows the common connector / CLI form (`npx`, `claude`, `codex`) resolves
 * to a `.cmd`/`.bat` command shim, which Node cannot `spawn` directly — a bare
 * `spawn("npx", …)` returns ENOENT. Node documents that these must run through
 * `cmd.exe`:
 * https://nodejs.org/api/child_process.html#spawning-bat-and-cmd-files-on-windows
 *
 * Centralised so every launcher (runClaude / runCodex / MCP stdio client) shares
 * one implementation and the Windows handling cannot drift per call-site.
 *
 * Callers pass piped stdio, so the returned streams are non-null.
 */
export const spawnCommand = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  platform: NodeJS.Platform = process.platform,
): ChildProcessWithoutNullStreams =>
  (platform === "win32"
    ? spawn("cmd.exe", ["/d", "/s", "/c", command, ...args], options)
    : spawn(command, [...args], options)) as ChildProcessWithoutNullStreams;
