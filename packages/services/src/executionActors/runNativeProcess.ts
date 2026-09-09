import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { Result, ResultAsync, type Result as Outcome } from "neverthrow";
import type { ExecutionError } from "@repo/schemas";
import { actorError, ExecutionActorError } from "./errors";
import type { ExecutionActorContext, ExecutionActorLimits, ScriptProcessReport } from "./types";

export type ScriptProcessOutcome = {
  stdout: Buffer;
  report: ScriptProcessReport;
  error?: ExecutionError;
};
const environmentFor = (workspace: string, executable: string): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    HOME: workspace,
    USERPROFILE: workspace,
    TEMP: join(workspace, "tmp"),
    TMP: join(workspace, "tmp"),
    APPDATA: join(workspace, "appdata"),
    LOCALAPPDATA: join(workspace, "appdata"),
    PATH: [
      dirname(executable),
      ...(process.platform === "win32"
        ? [join(process.env.SystemRoot ?? "C:/Windows", "System32")]
        : ["/usr/bin", "/bin"]),
    ].join(process.platform === "win32" ? ";" : ":"),
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
  };
  if (process.platform === "win32") {
    env.SystemRoot = process.env.SystemRoot ?? "C:/Windows";
    env.WINDIR = env.SystemRoot;
    env.PATHEXT = ".EXE;.COM";
  }

  return env;
};

/** Child environment is built from an allowlist, never copied from the service process. */
export const runNativeProcess = async (input: {
  context: ExecutionActorContext;
  workspace: string;
  arguments: string[];
  environment?: Record<string, string>;
  onStdout?: (chunk: Buffer) => Outcome<void, ExecutionError>;
  hasFirstOutput?: () => boolean;
  stdin: Uint8Array;
  limits: ExecutionActorLimits;
}): Promise<ScriptProcessOutcome> => {
  // .NET Framework's C# compiler cannot create its scratch files under long attempt paths.
  const launcherDirectory =
    process.platform === "win32" ? await mkdtemp(join(tmpdir(), "ordine-launch-")) : undefined;
  const argumentsPath = join(
    launcherDirectory ?? input.workspace,
    `.arguments-${randomUUID()}.json`,
  );
  if (process.platform === "win32")
    await writeFile(argumentsPath, JSON.stringify(input.arguments), {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
  const outcome = await new Promise<ScriptProcessOutcome>((resolve) => {
    const { context, limits, workspace } = input;
    const executable = context.resolved.executablePath!;
    const windows = process.platform === "win32";
    const cancellationPath = join(launcherDirectory ?? workspace, `.cancel-${randomUUID()}`);
    const command = windows
      ? join(
          process.env.SystemRoot ?? "C:/Windows",
          "System32",
          "WindowsPowerShell",
          "v1.0",
          "powershell.exe",
        )
      : executable;
    const args = windows
      ? [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          fileURLToPath(new URL("runWindowsScript.ps1", import.meta.url)),
          "-Executable",
          executable,
          "-ExecutableSha256",
          context.resolved.executableSha256!,
          "-ArgumentsPath",
          argumentsPath,
          "-CancellationPath",
          cancellationPath,
          "-ChildTemp",
          join(workspace, "tmp"),
        ]
      : input.arguments;
    const startedAt = new Date().toISOString();
    const spawned = Result.fromThrowable(
      () =>
        spawn(command, args, {
          cwd: workspace,
          env: {
            ...environmentFor(workspace, executable),
            ...input.environment,
            ...(launcherDirectory ? { TEMP: launcherDirectory, TMP: launcherDirectory } : {}),
          },
          windowsHide: true,
          detached: !windows,
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        }),
      () =>
        new ExecutionActorError("SCRIPT_START_FAILED", "Script interpreter could not be started."),
    )();
    if (spawned.isErr()) {
      resolve({
        stdout: Buffer.alloc(0),
        report: {
          startedAt,
          endedAt: new Date().toISOString(),
          exitCode: null,
          exitSignal: null,
          stdoutBytes: 0,
          stderrBytes: 0,
          stderr: "",
          failureCode: spawned.error.code,
        },
        error: actorError(spawned.error),
      });

      return;
    }
    const child = spawned.value;
    const state: {
      error?: ExecutionError;
      stdoutBytes: number;
      stderrBytes: number;
      done: boolean;
      firstOutput: boolean;
      terminating: boolean;
      forceTimer?: ReturnType<typeof setTimeout>;
      terminationTimer?: ReturnType<typeof setTimeout>;
      inactivityTimer?: ReturnType<typeof setTimeout>;
      firstTimer?: ReturnType<typeof setTimeout>;
      durationTimer?: ReturnType<typeof setTimeout>;
    } = { stdoutBytes: 0, stderrBytes: 0, done: false, firstOutput: false, terminating: false };
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const signalGroup = (signal: NodeJS.Signals) =>
      Result.fromThrowable(
        () => (child.pid ? process.kill(-child.pid, signal) : false),
        () => false,
      )();
    const terminate = () => {
      if (state.terminating || state.done) return;
      state.terminating = true;
      if (windows)
        void ResultAsync.fromPromise(writeFile(cancellationPath, "", { flag: "wx" }), () =>
          actorError(
            new ExecutionActorError(
              "SCRIPT_TERMINATION_FAILED",
              "Script cancellation could not be delivered.",
            ),
          ),
        ).mapErr((error) => {
          state.error = error;
          Result.fromThrowable(
            () => child.kill("SIGKILL"),
            () => false,
          )();
        });
      else {
        signalGroup("SIGTERM");
        state.forceTimer = setTimeout(() => signalGroup("SIGKILL"), 250);
      }
      state.terminationTimer = setTimeout(() => {
        state.error = actorError(
          new ExecutionActorError(
            "SCRIPT_TERMINATION_FAILED",
            "The script process tree did not converge after termination.",
          ),
        );
        if (windows)
          Result.fromThrowable(
            () => child.kill("SIGKILL"),
            () => false,
          )();
        finish(null, null);
      }, limits.terminationTimeoutMs);
    };
    const stop = (code: string, message: string) => {
      state.error ??= actorError(new ExecutionActorError(code, message));
      terminate();
    };
    const abort = () => stop("CANCELLED", "Script execution was cancelled.");
    const finish = (exitCode: number | null, exitSignal: NodeJS.Signals | null) => {
      if (state.done) return;
      state.done = true;
      context.signal.removeEventListener("abort", abort);
      for (const timer of [
        state.forceTimer,
        state.terminationTimer,
        state.inactivityTimer,
        state.firstTimer,
        state.durationTimer,
      ])
        if (timer) clearTimeout(timer);
      if (!windows) signalGroup("SIGKILL");
      if (!state.error && exitCode !== 0)
        state.error = actorError(
          new ExecutionActorError(
            "SCRIPT_EXIT_NONZERO",
            `Script exited with code ${exitCode ?? "unknown"}${exitSignal ? ` (${exitSignal})` : ""}.`,
          ),
        );
      const stderrBuffer = Buffer.concat(stderr);
      const decoded = Result.fromThrowable(
        () => new TextDecoder("utf-8", { fatal: true }).decode(stderrBuffer),
        () => "",
      )();
      const stderrText = decoded.isOk() ? decoded.value : "[stderr is not valid UTF-8]";
      resolve({
        stdout: Buffer.concat(stdout),
        report: {
          pid: child.pid,
          startedAt,
          endedAt: new Date().toISOString(),
          exitCode,
          exitSignal,
          stdoutBytes: state.stdoutBytes,
          stderrBytes: state.stderrBytes,
          stderr: stderrText,
          ...(state.error ? { failureCode: state.error.code } : {}),
        },
        ...(state.error ? { error: state.error } : {}),
      });
    };
    const touch = () => {
      if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
      state.inactivityTimer = setTimeout(
        () => stop("SCRIPT_INACTIVITY_TIMEOUT", "Script exceeded its inactivity timeout."),
        context.resolved.timeouts.inactivityTimeoutMs,
      );
    };
    const capture = (kind: "stdout" | "stderr", chunk: Buffer) => {
      if (state.done) return;
      const value = Buffer.from(chunk);
      if (kind === "stdout") state.stdoutBytes += value.byteLength;
      else state.stderrBytes += value.byteLength;
      if (
        state.stdoutBytes > limits.maxStdoutBytes ||
        state.stderrBytes > limits.maxStderrBytes ||
        state.stdoutBytes + state.stderrBytes > limits.maxOutputBytes
      ) {
        stop(
          "SCRIPT_OUTPUT_LIMIT",
          "Script exceeded its stdout, stderr, or combined output byte limit.",
        );

        return;
      }
      if (state.error) return;
      (kind === "stdout" ? stdout : stderr).push(value);
      if (kind === "stdout" && input.onStdout) {
        const accepted = Result.fromThrowable(
          () => input.onStdout!(value),
          () =>
            actorError(
              new ExecutionActorError(
                "RUNTIME_STREAM_INVALID",
                "Runtime stream processing failed.",
              ),
            ),
        )().andThen((result) => result);
        if (accepted.isErr()) {
          state.error = accepted.error;
          terminate();

          return;
        }
      }
      if (!state.firstOutput && (input.hasFirstOutput?.() ?? true)) {
        state.firstOutput = true;
        if (state.firstTimer) clearTimeout(state.firstTimer);
      }
      touch();
    };
    child.stdout.on("data", (chunk: Buffer) => capture("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => capture("stderr", chunk));
    child.on("error", () => {
      state.error = actorError(
        new ExecutionActorError("SCRIPT_START_FAILED", "Script interpreter could not be started."),
      );
    });
    child.on("exit", () => {
      if (!windows) signalGroup("SIGKILL");
    });
    child.on("close", finish);
    child.stdin.on("error", () => {
      if (!state.done && !state.error)
        stop("SCRIPT_STDIN_FAILED", "Structured input could not be delivered to the script.");
    });
    context.signal.addEventListener("abort", abort, { once: true });
    state.durationTimer = setTimeout(
      () => stop("SCRIPT_TIMEOUT", "Script exceeded its total execution time limit."),
      Math.min(limits.maxDurationMs, context.resolved.timeouts.activeRunTimeoutMs),
    );
    if (context.resolved.timeouts.firstOutputTimeoutMs > 0)
      state.firstTimer = setTimeout(
        () =>
          stop(
            "SCRIPT_FIRST_OUTPUT_TIMEOUT",
            "Script produced no output before its first-output deadline.",
          ),
        context.resolved.timeouts.firstOutputTimeoutMs,
      );
    touch();
    if (context.signal.aborted) abort();
    else child.stdin.end(input.stdin);
  });
  if (launcherDirectory) {
    if (
      dirname(resolvePath(launcherDirectory)) !== resolvePath(tmpdir()) ||
      !basename(launcherDirectory).startsWith("ordine-launch-")
    )
      throw new ExecutionActorError("SCRIPT_CLEANUP_FAILED", "Launcher cleanup path is invalid.");
    await rm(launcherDirectory, { recursive: true, force: true });
  }

  return outcome;
};
