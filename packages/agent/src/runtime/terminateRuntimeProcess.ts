import type { ChildProcess } from "node:child_process";
import { Result } from "neverthrow";
import { spawnCommand } from "../spawn/spawnCommand";

const signalProcess = Result.fromThrowable(
  (pid: number, signal: NodeJS.Signals | 0) => process.kill(pid, signal),
  () => false,
);

const isAlive = (pid: number): boolean => {
  const result = signalProcess(pid, 0);

  return result.isOk() && result.value;
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const runTaskkill = (pid: number, force: boolean): Promise<void> =>
  new Promise((resolve) => {
    const args = ["/pid", String(pid), "/t", ...(force ? ["/f"] : [])];
    const killer = spawnCommand("taskkill.exe", args, {
      stdio: ["ignore", "ignore", "ignore"],
      windowsHide: true,
    });
    const finish = () => resolve();
    killer.on("error", finish);
    killer.on("close", finish);
  });

export const terminateRuntimeProcess = async (
  child: Pick<ChildProcess, "pid" | "kill">,
  platform: NodeJS.Platform = process.platform,
): Promise<void> => {
  const pid = child.pid;
  if (!pid) {
    child.kill("SIGTERM");

    return;
  }
  if (platform === "win32") {
    await runTaskkill(pid, false);
  } else {
    const groupSignal = signalProcess(-pid, "SIGTERM");
    if (groupSignal.isErr() || !groupSignal.value) child.kill("SIGTERM");
  }
  if (!isAlive(pid)) return;
  await wait(3_000);
  if (!isAlive(pid)) return;
  if (platform === "win32") {
    await runTaskkill(pid, true);
  } else {
    const groupSignal = signalProcess(-pid, "SIGKILL");
    if (groupSignal.isErr() || !groupSignal.value) child.kill("SIGKILL");
  }
  if (isAlive(pid)) {
    throw new Error(`Runtime process tree ${pid} is still alive after forced termination`);
  }
};
