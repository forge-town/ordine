import { randomUUID, createHash } from "node:crypto";
import { appendFile, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { Result, ResultAsync, ok, type Result as Outcome } from "neverthrow";
import {
  OperationRevisionSchema,
  RuntimeNodeSchema,
  EXECUTION_TIMEOUT_DEFAULTS,
  type ExecutionError,
  type ExecutionPrincipal,
} from "@repo/schemas";
import type { ExecutionArtifactRecord, ExecutionInputAssetRecord } from "@repo/db-schema";
import { ArtifactStoreError, createExecutionArtifactStore } from "../executionArtifacts";
import {
  createExecutionActors,
  type ExecutionActorContext,
  type ScriptProcessReport,
} from "./index";

const directories: string[] = [];
const unwrap = <T, E>(result: Outcome<T, E>): T => {
  if (result.isErr()) throw result.error;

  return result.value;
};
const codeOf = (result: Outcome<unknown, ExecutionError>) =>
  result.isErr() ? result.error.code : "OK";
const principal: ExecutionPrincipal = {
  subjectId: "owner",
  workspaceId: "workspace",
  scopes: ["artifacts:read", "artifacts:import"],
};
const fingerprint = async (path: string) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const fixture = async (
  source = 'process.stdout.write("hello")',
  outputMode: "text" | "json" | "manifest" = "text",
  longRoot = false,
) => {
  const directory = await mkdtemp(join(tmpdir(), "ordine-actors-test-"));
  directories.push(directory);
  const inputs = new Map<string, ExecutionInputAssetRecord>();
  const artifacts = new Map<string, ExecutionArtifactRecord>();
  const controller = new AbortController();
  const jobId = randomUUID();
  const attemptId = randomUUID();
  const store = unwrap(
    await createExecutionArtifactStore({
      rootDirectory: longRoot
        ? join(directory, "中文正式产物路径", `execution_runtime_${"a".repeat(32)}`, randomUUID())
        : directory,
      persistence: {
        replayInputImport: async () => null,
        createInputAsset: async (identity, data) => {
          const row = { ...identity, ...data };
          inputs.set(row.artifactId, row);

          return row;
        },
        getInputAsset: async (_identity, id) => inputs.get(id) ?? null,
        getProducedArtifact: async (_identity, id) => artifacts.get(id) ?? null,
        registerArtifact: async (_lease, data) => {
          const row = { ...data.metadata, ...data };
          artifacts.set(row.artifactId, row);

          return row;
        },
        assertLease: async () => {
          if (controller.signal.aborted) throw new Error("cancelled lease");
        },
        assertJobLease: async () => {
          if (controller.signal.aborted) throw new Error("cancelled lease");
        },
      },
    }),
  );
  const operation = OperationRevisionSchema.parse({
    apiVersion: 2,
    id: "script",
    revision: 1,
    name: "script",
    inputPorts: [],
    outputPorts: [
      { id: "out", valueType: outputMode === "json" ? "json" : "text", cardinality: "one" },
    ],
    executor: { kind: "script", language: "javascript", source, outputMode },
  });
  const context: ExecutionActorContext = {
    jobId,
    attemptId,
    node: RuntimeNodeSchema.parse({
      id: "node",
      operation: { operationId: "script", revision: 1 },
    }),
    operation,
    resolved: {
      executorKind: "script",
      executablePath: process.execPath,
      executableSha256: await fingerprint(process.execPath),
      timeouts: {
        ...EXECUTION_TIMEOUT_DEFAULTS,
        firstOutputTimeoutMs: 10_000,
        inactivityTimeoutMs: 10_000,
      },
      origins: {},
    },
    inputs: {},
    iteration: 1,
    attemptNumber: 1,
    sharedContext: "shared 中文",
    signal: controller.signal,
    artifactContext: {
      lease: {
        subjectId: principal.subjectId,
        workspaceId: principal.workspaceId,
        jobId,
        executorId: "executor",
        generation: 1,
      },
      nodeId: "node",
      attemptId,
      signal: controller.signal,
    },
  };

  return { directory, store, context, controller, artifacts };
};
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    const candidate = resolve(directory);
    if (
      dirname(candidate) !== resolve(tmpdir()) ||
      !basename(candidate).startsWith("ordine-actors-test-")
    )
      throw new Error("Unsafe fixture cleanup path");
    await rm(candidate, { recursive: true, force: true });
  }
});

describe("v2 execution actors with real child processes and real ArtifactStore files", () => {
  it.runIf(process.platform === "win32")(
    "runs a script under a long Chinese production artifact root and preserves child TEMP",
    async () => {
      const f = await fixture(
        'import fs from "node:fs";import path from "node:path";process.stdout.write(String(process.env.TEMP===path.join(process.cwd(),"tmp") && fs.existsSync(process.env.TEMP)))',
        "text",
        true,
      );
      const workspace = unwrap(await f.store.createAttemptWorkspace(f.context.artifactContext));
      expect(workspace.length).toBeGreaterThan(220);
      const result = await createExecutionActors({ artifactStore: f.store }).execute(f.context);
      expect(codeOf(result)).toBe("OK");
      expect(unwrap(result).out).toEqual([{ kind: "text", value: "true" }]);
    },
    25_000,
  );
  it.runIf(!!process.env.ORDINE_ACTOR_TEST_PYTHON)(
    "runs prepared Python with UTF-8 stdin and stdout",
    async () => {
      const f = await fixture(
        'import sys, json\nx=json.load(sys.stdin)\nprint(x["sharedContext"], end="")',
      );
      if (f.context.operation.executor.kind !== "script") throw new Error("script required");
      f.context.operation.executor.language = "python";
      f.context.resolved.executablePath = process.env.ORDINE_ACTOR_TEST_PYTHON!;
      f.context.resolved.executableSha256 = await fingerprint(f.context.resolved.executablePath);
      expect(
        unwrap(await createExecutionActors({ artifactStore: f.store }).execute(f.context)).out,
      ).toEqual([{ kind: "text", value: "shared 中文" }]);
    },
    20_000,
  );
  it.runIf(!!process.env.ORDINE_ACTOR_TEST_BASH)(
    "runs a prepared Bash binary with UTF-8 output",
    async () => {
      const f = await fixture('read -r input\nprintf "shell 中文"');
      if (f.context.operation.executor.kind !== "script") throw new Error("script required");
      f.context.operation.executor.language = "bash";
      f.context.resolved.executablePath = process.env.ORDINE_ACTOR_TEST_BASH!;
      f.context.resolved.executableSha256 = await fingerprint(f.context.resolved.executablePath);
      expect(
        unwrap(await createExecutionActors({ artifactStore: f.store }).execute(f.context)).out,
      ).toEqual([{ kind: "text", value: "shell 中文" }]);
    },
    20_000,
  );
  it("executes frozen JavaScript with structured stdin and no server credentials", async () => {
    const f = await fixture(
      'import fs from "node:fs"; const x=JSON.parse(fs.readFileSync(0,"utf8")); process.stdout.write(JSON.stringify({...x, hasSecret:Object.keys(process.env).some(k=>/TOKEN|DATABASE|AUTH/i.test(k)), cwd:process.cwd()===process.env.HOME}));',
      "json",
    );
    f.context.inputs = { in: [{ kind: "text", value: "input 中文" }] };
    const result = unwrap(
      await createExecutionActors({ artifactStore: f.store }).execute(f.context),
    );
    expect(result.out).toEqual([
      {
        kind: "json",
        value: {
          apiVersion: 2,
          sharedContext: "shared 中文",
          jobId: f.context.jobId,
          nodeId: f.context.node.id,
          attemptId: f.context.attemptId,
          iteration: 1,
          attemptNumber: 1,
          inputs: f.context.inputs,
          artifactFiles: {},
          hasSecret: false,
          cwd: true,
        },
      },
    ]);
  }, 20_000);
  it("reports nonzero exits, malformed JSON and an executable fingerprint change", async () => {
    const failed = await fixture('process.stderr.write("diagnostic");process.exit(7)');
    expect(
      codeOf(await createExecutionActors({ artifactStore: failed.store }).execute(failed.context)),
    ).toBe("SCRIPT_EXIT_NONZERO");
    const invalid = await fixture('process.stdout.write("not json")', "json");
    expect(
      codeOf(
        await createExecutionActors({ artifactStore: invalid.store }).execute(invalid.context),
      ),
    ).toBe("SCRIPT_OUTPUT_INVALID");
    invalid.context.resolved.executableSha256 = "0".repeat(64);
    expect(
      codeOf(
        await createExecutionActors({ artifactStore: invalid.store }).execute(invalid.context),
      ),
    ).toBe("EXECUTABLE_CHANGED");
  }, 30_000);
  it("fails on stdout/stderr and combined byte limits without returning truncated output", async () => {
    for (const source of [
      'process.stdout.write("x".repeat(5000))',
      'process.stderr.write("x".repeat(5000))',
      'process.stdout.write("x".repeat(700));process.stderr.write("y".repeat(700))',
    ]) {
      const f = await fixture(source);
      const result = await createExecutionActors({
        artifactStore: f.store,
        limits: { maxStdoutBytes: 1000, maxStderrBytes: 1000, maxOutputBytes: 1200 },
      }).execute(f.context);
      expect(codeOf(result)).toBe("SCRIPT_OUTPUT_LIMIT");
    }
  }, 30_000);
  it("enforces first-output, inactivity and total timeouts", async () => {
    const first = await fixture("setInterval(()=>{},1000)");
    first.context.resolved.timeouts.firstOutputTimeoutMs = 1500;
    expect(
      codeOf(await createExecutionActors({ artifactStore: first.store }).execute(first.context)),
    ).toBe("SCRIPT_FIRST_OUTPUT_TIMEOUT");
    const idle = await fixture('process.stdout.write("started");setInterval(()=>{},1000)');
    idle.context.resolved.timeouts.inactivityTimeoutMs = 1500;
    expect(
      codeOf(await createExecutionActors({ artifactStore: idle.store }).execute(idle.context)),
    ).toBe("SCRIPT_INACTIVITY_TIMEOUT");
    const total = await fixture('setInterval(()=>process.stdout.write("."),100)');
    expect(
      codeOf(
        await createExecutionActors({
          artifactStore: total.store,
          limits: { maxDurationMs: 1800 },
        }).execute(total.context),
      ),
    ).toBe("SCRIPT_TIMEOUT");
  }, 30_000);
  it("supports disabled first-output timeout and propagates cancellation", async () => {
    const f = await fixture("setInterval(()=>{},1000)");
    f.context.resolved.timeouts.firstOutputTimeoutMs = 0;
    const running = createExecutionActors({ artifactStore: f.store }).execute(f.context);
    const timer = setTimeout(() => f.controller.abort(), 1500);
    const result = await running;
    clearTimeout(timer);
    expect(codeOf(result)).toBe("CANCELLED");
  }, 20_000);
  it("registers only explicit workspace-relative manifest files and reads the real content", async () => {
    const f = await fixture(
      'import fs from "node:fs"; fs.writeFileSync("result.txt","真实文件");process.stdout.write(JSON.stringify({outputs:{out:[{kind:"file",relativePath:"result.txt",name:"result.txt",mimeType:"text/plain"}]}}));',
      "manifest",
    );
    f.context.operation.outputPorts[0]!.valueType = "artifact";
    const output = unwrap(
      await createExecutionActors({ artifactStore: f.store }).execute(f.context),
    );
    const value = output.out![0]!;
    expect(value.kind).toBe("artifact");
    if (value.kind !== "artifact") return;
    const read = unwrap(
      await f.store.readForExecution(f.context.artifactContext, value.artifactId),
    );
    expect(new TextDecoder().decode(read.bytes)).toBe("真实文件");
    const unsafe = await fixture(
      'process.stdout.write(JSON.stringify({outputs:{out:[{kind:"file",relativePath:"../secret.txt",name:"secret.txt",mimeType:"text/plain"}]}}));',
      "manifest",
    );
    unsafe.context.operation.outputPorts[0]!.valueType = "artifact";
    expect(
      codeOf(await createExecutionActors({ artifactStore: unsafe.store }).execute(unsafe.context)),
    ).toBe("ARTIFACT_PATH_INVALID");
  }, 25_000);
  it("materializes input artifact bytes only via the store and explicit stdin mappings", async () => {
    const f = await fixture(
      'import fs from "node:fs";const x=JSON.parse(fs.readFileSync(0,"utf8"));const item=x.artifactFiles[x.inputs.in[0].artifactId];process.stdout.write(fs.readFileSync(item.relativePath,"utf8"));',
    );
    const imported = unwrap(
      await f.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "input.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("文件输入"),
      }),
    );
    f.context.inputs = { in: [{ kind: "artifact", artifactId: imported.artifactId }] };
    expect(
      unwrap(await createExecutionActors({ artifactStore: f.store }).execute(f.context)).out,
    ).toEqual([{ kind: "text", value: "文件输入" }]);
  }, 20_000);
  it("executes builtin write/read/materialize/identity/merge against real Store files", async () => {
    const f = await fixture();
    const actors = createExecutionActors({ artifactStore: f.store });
    f.context.resolved = {
      executorKind: "builtin",
      timeouts: EXECUTION_TIMEOUT_DEFAULTS,
      origins: {},
    };
    f.context.operation.executor = {
      kind: "builtin",
      name: "write_artifact",
      config: { name: "result.txt", mimeType: "text/plain" },
    };
    f.context.operation.inputPorts = [
      { id: "in", valueType: "text", cardinality: "one", required: true, allowEmpty: false },
    ];
    f.context.operation.outputPorts[0]!.valueType = "artifact";
    f.context.inputs = { in: [{ kind: "text", value: "written" }] };
    const written = unwrap(await actors.execute(f.context));
    f.context.operation.executor = { kind: "builtin", name: "read_artifact", config: {} };
    f.context.operation.inputPorts[0]!.valueType = "artifact";
    f.context.operation.outputPorts[0]!.valueType = "text";
    f.context.inputs = { in: written.out! };
    expect(unwrap(await actors.execute(f.context)).out).toEqual([
      { kind: "text", value: "written" },
    ]);
    f.context.operation.executor = { kind: "builtin", name: "identity", config: {} };
    f.context.operation.inputPorts[0]!.valueType = "text";
    f.context.inputs = { in: [{ kind: "text", value: "identity" }] };
    expect(unwrap(await actors.execute(f.context)).out).toEqual(f.context.inputs.in);
    f.context.operation.executor = {
      kind: "builtin",
      name: "merge_text",
      config: { separator: "|" },
    };
    f.context.operation.inputPorts[0]!.cardinality = "many";
    f.context.inputs = {
      in: [
        { kind: "text", value: "one" },
        { kind: "text", value: "two" },
      ],
    };
    expect(unwrap(await actors.execute(f.context)).out).toEqual([
      { kind: "text", value: "one|two" },
    ]);
    const input = unwrap(
      await f.store.importInput(principal, {
        importRequestId: randomUUID(),
        name: "asset.txt",
        mimeType: "text/plain",
        bytes: new TextEncoder().encode("asset"),
      }),
    );
    f.context.operation.executor = {
      kind: "builtin",
      name: "materialize_file",
      config: { assetId: input.artifactId },
    };
    f.context.operation.inputPorts = [];
    f.context.operation.outputPorts[0]!.valueType = "artifact";
    f.context.inputs = {};
    const materialized = unwrap(await actors.execute(f.context));
    expect(materialized.out![0]).not.toEqual({ kind: "artifact", artifactId: input.artifactId });
  });
  it.runIf(process.platform === "win32").each(["cancel", "success"])(
    "converges detached child and grandchild processes before %s returns",
    async (mode) => {
      const grandchildSource =
        'require("node:fs").writeFileSync("grandchild.pid",String(process.pid));setInterval(()=>{},1000)';
      const childSource = `require("node:fs").writeFileSync("child.pid",String(process.pid));require("node:child_process").spawn(process.execPath,["-e",${JSON.stringify(grandchildSource)}],{stdio:"ignore",detached:true}).unref();setInterval(()=>{},1000)`;
      const f = await fixture(
        `import {spawn} from "node:child_process";import fs from "node:fs";fs.writeFileSync("parent.pid",String(process.pid));spawn(process.execPath,["-e",${JSON.stringify(childSource)}],{stdio:"ignore",detached:true}).unref();const timer=setInterval(()=>{if(fs.existsSync("grandchild.pid")){clearInterval(timer);process.stdout.write("ready");${mode === "success" ? "process.exit(0)" : "setInterval(()=>{},1000)"}}},25)`,
      );
      const workspace = unwrap(await f.store.createAttemptWorkspace(f.context.artifactContext));
      const running = createExecutionActors({ artifactStore: f.store }).execute(f.context);
      const ready = { pid: 0 };
      for (const _ of Array.from({ length: 100 })) {
        const read = await ResultAsync.fromPromise(
          readFile(join(workspace, "grandchild.pid"), "utf8"),
          () => undefined,
        );
        if (read.isOk()) {
          ready.pid = Number(read.value);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(ready.pid).toBeGreaterThan(0);
      if (mode === "cancel") f.controller.abort();
      expect(codeOf(await running)).toBe(mode === "cancel" ? "CANCELLED" : "OK");
      for (const name of ["parent", "child", "grandchild"]) {
        const pid = Number(await readFile(join(workspace, `${name}.pid`), "utf8"));
        expect(
          Result.fromThrowable(
            () => process.kill(pid, 0),
            () => false,
          )().isErr(),
          `${name} ${pid} must be dead`,
        ).toBe(true);
      }
    },
    30_000,
  );

  it("rejects absent prepared interpreters, command shims and changed executable bytes", async () => {
    const f = await fixture();
    delete f.context.resolved.executablePath;
    expect(codeOf(await createExecutionActors({ artifactStore: f.store }).execute(f.context))).toBe(
      "EXECUTABLE_NOT_PREPARED",
    );
    f.context.resolved.executablePath = join(f.directory, "node.cmd");
    expect(codeOf(await createExecutionActors({ artifactStore: f.store }).execute(f.context))).toBe(
      "EXECUTABLE_UNSUPPORTED",
    );
    const executable = join(f.directory, "changed.exe");
    await writeFile(executable, "before", "utf8");
    f.context.resolved.executablePath = executable;
    f.context.resolved.executableSha256 = await fingerprint(executable);
    await writeFile(executable, "after", "utf8");
    expect(codeOf(await createExecutionActors({ artifactStore: f.store }).execute(f.context))).toBe(
      "EXECUTABLE_CHANGED",
    );
  });

  it.runIf(process.platform === "win32")(
    "rejects interpreter mutation between adapter verification and Windows launch",
    async () => {
      const f = await fixture();
      const executable = join(f.directory, "prepared-node.exe");
      await copyFile(process.execPath, executable);
      f.context.resolved.executablePath = executable;
      f.context.resolved.executableSha256 = await fingerprint(executable);
      const reports: ScriptProcessReport[] = [];
      const result = await createExecutionActors({
        artifactStore: {
          ...f.store,
          createAttemptWorkspace: (context) =>
            f.store
              .createAttemptWorkspace(context)
              .andThen((workspace) =>
                ResultAsync.fromPromise(
                  appendFile(executable, "changed-after-verification", "utf8"),
                  () =>
                    new ArtifactStoreError(
                      "TEST_MUTATION_FAILED",
                      "Could not mutate interpreter fixture.",
                      "artifact",
                    ),
                ).map(() => workspace),
              ),
        },
        onProcessResult: async (_context, report) => {
          reports.push(report);

          return ok(undefined);
        },
      }).execute(f.context);
      expect(codeOf(result)).toBe("SCRIPT_EXIT_NONZERO");
      expect(reports[0]?.stderr).toContain("Prepared interpreter fingerprint changed");
      expect(reports[0]?.stdoutBytes).toBe(0);
    },
    20_000,
  );

  it.each([
    { outputs: { unknown: [{ kind: "text", value: "x" }] } },
    { outputs: { out: [{ kind: "json", value: 1 }] } },
    {
      outputs: {
        out: [
          { kind: "text", value: "a" },
          { kind: "text", value: "b" },
        ],
      },
    },
    { outputs: {} },
  ])(
    "rejects manifests outside the declared port contract: %j",
    async (manifest) => {
      const f = await fixture(
        `process.stdout.write(${JSON.stringify(JSON.stringify(manifest))})`,
        "manifest",
      );
      expect(
        codeOf(await createExecutionActors({ artifactStore: f.store }).execute(f.context)),
      ).toBe("SCRIPT_OUTPUT_CONTRACT_INVALID");
      expect(f.artifacts.size).toBe(0);
    },
    20_000,
  );

  it("validates JSON output schemas and forbids unknown artifact references", async () => {
    const json = await fixture('process.stdout.write("123")', "json");
    json.context.operation.outputPorts[0]!.jsonSchema = { type: "string" };
    expect(
      codeOf(await createExecutionActors({ artifactStore: json.store }).execute(json.context)),
    ).toBe("JSON_VALUE_INVALID");
    const artifact = await fixture(
      'process.stdout.write(JSON.stringify({outputs:{out:[{kind:"artifact",artifactId:"missing"}]}}))',
      "manifest",
    );
    artifact.context.operation.outputPorts[0]!.valueType = "artifact";
    expect(
      codeOf(
        await createExecutionActors({ artifactStore: artifact.store }).execute(artifact.context),
      ),
    ).toBe("ARTIFACT_NOT_FOUND");
  }, 25_000);

  it("records bounded stderr diagnostics without mixing them into successful output", async () => {
    const f = await fixture('process.stderr.write("诊断");process.stdout.write("result")');
    const reports: ScriptProcessReport[] = [];
    expect(
      unwrap(
        await createExecutionActors({
          artifactStore: f.store,
          onProcessResult: async (_context, report) => {
            reports.push(report);

            return ok(undefined);
          },
        }).execute(f.context),
      ).out,
    ).toEqual([{ kind: "text", value: "result" }]);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      exitCode: 0,
      stderr: "诊断",
      stderrBytes: 6,
      stdoutBytes: 6,
    });
  }, 20_000);
});
