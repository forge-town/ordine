/* eslint-disable ordine-error/no-try, ordine-vars/no-let -- acceptance cleanup and evidence accumulation */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { AgentRun, AgentRunEventEnvelope, AgentRuntime } from "@repo/schemas";
import { beforeAll, describe, expect, it } from "vitest";
import { createAgentRunsService } from "./createAgentRunsService";

const execFileAsync = promisify(execFile);
const enabled =
  process.platform === "win32" && process.env["ORDINE_WINDOWS_RUNTIME_ACCEPTANCE"] === "1";
const selectedRuntime = process.env["ORDINE_WINDOWS_RUNTIME"];
const runtimes = (["codex", "claude-code", "opencode"] as const).filter(
  (runtime) => !selectedRuntime || runtime === selectedRuntime,
);

type AgentRunsService = ReturnType<typeof createAgentRunsService>;

type RunEvidence = {
  runId: string;
  status: AgentRun["status"];
  executablePath: string | null;
  executableVersion: string | null;
  executableFingerprint: string | null;
  nativeSessionId: string | null;
  usage: AgentRun["usage"];
  firstSequence: number | null;
  lastSequence: number | null;
  eventTypes: Record<string, number>;
  processIds: number[];
  processTreeCleaned: boolean;
};

type RuntimeEvidence = {
  runtime: AgentRuntime;
  cwd: string;
  firstRun?: RunEvidence;
  resumeRun?: RunEvidence;
  cancelRun?: RunEvidence;
  filePath?: string;
  fileSha256?: string;
  error?: string;
};

const evidence = {
  generatedAt: new Date().toISOString(),
  platform: process.platform,
  architecture: process.arch,
  database: "dedicated COD-369 acceptance database (credentials omitted)",
  runtimes: [] as RuntimeEvidence[],
};

let service: AgentRunsService;
let acceptanceRoot = "";
let evidencePath = "";

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);

    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
};

const waitForPidCleanup = async (pids: readonly number[]): Promise<boolean> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (pids.every((pid) => !isPidAlive(pid))) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }

  return pids.every((pid) => !isPidAlive(pid));
};

const processIdsFrom = (events: readonly AgentRunEventEnvelope[]): number[] => [
  ...new Set(
    events.flatMap(({ event }) => {
      if (event.type !== "diagnostic" || event.code !== "RUNTIME_PROCESS_STARTED") return [];
      const pid = event.metadata?.["pid"];

      return typeof pid === "number" && Number.isInteger(pid) && pid > 0 ? [pid] : [];
    }),
  ),
];

const summarizeRun = async (run: AgentRun): Promise<RunEvidence> => {
  const events = await service.getEvents(run.id, 0);
  const sequences = events.map((event) => event.sequence);
  const processIds = processIdsFrom(events);

  expect(sequences).toEqual([...sequences].sort((left, right) => left - right));
  expect(new Set(sequences).size).toBe(sequences.length);
  expect(events.filter(({ event }) => event.type === "terminal")).toHaveLength(1);

  return {
    runId: run.id,
    status: run.status,
    executablePath: run.executablePath,
    executableVersion: run.executableVersion,
    executableFingerprint: run.executableFingerprint,
    nativeSessionId: run.nativeSessionId,
    usage: run.usage,
    firstSequence: sequences[0] ?? null,
    lastSequence: sequences.at(-1) ?? null,
    eventTypes: Object.fromEntries(
      [...new Set(events.map(({ event }) => event.type))].map((type) => [
        type,
        events.filter(({ event }) => event.type === type).length,
      ]),
    ),
    processIds,
    processTreeCleaned: await waitForPidCleanup(processIds),
  };
};

const persistEvidence = () =>
  writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8" });

const nonEmptyUtf8Lines = (value: string): string[] =>
  value
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter((line) => line.length > 0);

beforeAll(async () => {
  if (!enabled) return;
  const configuredRoot = process.env["ORDINE_WINDOWS_RUNTIME_ACCEPTANCE_ROOT"];
  if (!configuredRoot) {
    throw new Error("ORDINE_WINDOWS_RUNTIME_ACCEPTANCE_ROOT must be an absolute path");
  }
  acceptanceRoot = resolve(configuredRoot);
  await mkdir(acceptanceRoot, { recursive: true });
  evidencePath = join(acceptanceRoot, "acceptance.json");
  const { db } = await import("@repo/db");
  service = createAgentRunsService(db);
  await persistEvidence();
});

describe.skipIf(!enabled)("COD-369 Windows runtime acceptance", () => {
  it.each(runtimes)(
    "%s supports default full access, native resume, durable events, and cancellation",
    async (runtime) => {
      const runtimeEvidence: RuntimeEvidence = {
        runtime,
        cwd: join(acceptanceRoot, runtime),
      };
      evidence.runtimes.push(runtimeEvidence);

      try {
        await mkdir(runtimeEvidence.cwd, { recursive: true });
        await execFileAsync("git", ["init", "--quiet"], { cwd: runtimeEvidence.cwd });
        const fileName = "acceptance.txt";
        const filePath = join(runtimeEvidence.cwd, fileName);
        const marker = runtime.replaceAll("-", "_").toUpperCase();
        const firstLine = `ORDINE_COD369_${marker}_CREATE`;
        const resumeLine = `ORDINE_COD369_${marker}_RESUME`;
        const firstPrompt = [
          `Use your file editing tool to create ${fileName} in the current workspace.`,
          `Its only non-empty UTF-8 line must be ${JSON.stringify(firstLine)}.`,
          "Do not only describe the change. Verify the file, then reply with a short confirmation.",
        ].join(" ");
        const firstStarted = await service.start({
          owner: { type: "cod369-windows-acceptance", id: runtime },
          runtimeConfigId: `local-${runtime}`,
          cwd: runtimeEvidence.cwd,
          systemPrompt:
            "You are running an ORDINE runtime acceptance test. Follow the file instruction exactly.",
          prompt: firstPrompt,
          rebuildPrompt: firstPrompt,
          permissionMode: "full-access",
          networkAccess: true,
          fullAccessConfirmed: true,
          allowedTools: [],
        });
        const firstRun = await service.wait(firstStarted.runId);
        runtimeEvidence.firstRun = await summarizeRun(firstRun);
        expect(firstRun.status).toBe("completed");
        expect(firstRun.nativeSessionId).toBeTruthy();
        expect(firstRun.usage).not.toBeNull();
        expect(runtimeEvidence.firstRun.processIds.length).toBeGreaterThan(0);
        expect(runtimeEvidence.firstRun.processTreeCleaned).toBe(true);
        expect(runtimeEvidence.firstRun.eventTypes["tool_start"]).toBeGreaterThan(0);
        expect(runtimeEvidence.firstRun.eventTypes["tool_result"]).toBeGreaterThan(0);
        expect(nonEmptyUtf8Lines(await readFile(filePath, "utf8"))).toEqual([firstLine]);

        const resumePrompt = [
          `Continue the same session and append one line to ${fileName}.`,
          `The final non-empty UTF-8 lines must be exactly ${JSON.stringify([firstLine, resumeLine])}.`,
          "Verify it, then reply with a short confirmation.",
        ].join(" ");
        const resumeStarted = await service.start({
          owner: { type: "cod369-windows-acceptance", id: runtime },
          runtimeConfigId: `local-${runtime}`,
          cwd: runtimeEvidence.cwd,
          systemPrompt:
            "You are running an ORDINE runtime acceptance test. Follow the file instruction exactly.",
          prompt: resumePrompt,
          rebuildPrompt: `${firstPrompt}\n\nAssistant confirmed the file creation.\n\n${resumePrompt}`,
          resumeFromRunId: firstRun.id,
          permissionMode: "full-access",
          networkAccess: true,
          fullAccessConfirmed: true,
          allowedTools: [],
        });
        const resumeRun = await service.wait(resumeStarted.runId);
        runtimeEvidence.resumeRun = await summarizeRun(resumeRun);
        expect(resumeRun.status).toBe("completed");
        expect(resumeRun.nativeSessionId).toBeTruthy();
        expect(resumeRun.usage).not.toBeNull();
        expect(runtimeEvidence.resumeRun.processTreeCleaned).toBe(true);
        const finalBytes = await readFile(filePath);
        expect(nonEmptyUtf8Lines(finalBytes.toString("utf8"))).toEqual([firstLine, resumeLine]);
        runtimeEvidence.filePath = filePath;
        runtimeEvidence.fileSha256 = createHash("sha256").update(finalBytes).digest("hex");

        const cancelPrompt = [
          "Start a shell command that waits for 120 seconds before returning.",
          "Do not finish your answer until that command finishes.",
          "This run will be cancelled by the acceptance controller.",
        ].join(" ");
        const cancelStarted = await service.start({
          owner: { type: "cod369-windows-acceptance-cancel", id: runtime },
          runtimeConfigId: `local-${runtime}`,
          cwd: runtimeEvidence.cwd,
          systemPrompt: "Use an appropriate Windows shell command when asked to wait.",
          prompt: cancelPrompt,
          rebuildPrompt: cancelPrompt,
          permissionMode: "full-access",
          networkAccess: true,
          fullAccessConfirmed: true,
          allowedTools: ["Bash"],
        });

        let observedRuntimeProcess = false;
        for (let attempt = 0; attempt < 80; attempt += 1) {
          const events = await service.getEvents(cancelStarted.runId, 0);
          observedRuntimeProcess = processIdsFrom(events).length > 0;
          if (observedRuntimeProcess && events.some(({ event }) => event.type === "tool_start")) {
            break;
          }
          await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
        }
        expect(observedRuntimeProcess).toBe(true);
        await service.cancel(cancelStarted.runId);
        const cancelRun = await service.wait(cancelStarted.runId);
        runtimeEvidence.cancelRun = await summarizeRun(cancelRun);
        expect(cancelRun.status).toBe("cancelled");
        expect(runtimeEvidence.cancelRun.processIds.length).toBeGreaterThan(0);
        expect(runtimeEvidence.cancelRun.processTreeCleaned).toBe(true);
      } catch (error) {
        runtimeEvidence.error =
          error instanceof Error ? (error.stack ?? error.message) : String(error);
        throw error;
      } finally {
        await persistEvidence();
      }
    },
    5 * 60 * 1000,
  );

  it("writes a redacted acceptance artifact", async () => {
    expect(basename(evidencePath)).toBe("acceptance.json");
    expect(evidence.runtimes).toHaveLength(runtimes.length);
    expect(evidence.runtimes.every((runtime) => !runtime.error)).toBe(true);
    await persistEvidence();
  });
});
