import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { ok, ResultAsync } from "neverthrow";
import type { RuntimeEvent } from "@repo/schemas";
import { createExecutionPromptActor } from "./index";
import { promptFixture } from "./testSupport";

const directories: string[] = [];
const cleanup = async (path: string) => {
  const candidate = resolve(path);
  if (
    dirname(candidate) !== resolve(tmpdir()) ||
    !basename(candidate).startsWith("ordine-prompt-test-")
  )
    throw new Error("Unsafe fixture cleanup path");
  await rm(candidate, { recursive: true, force: true });
};
describe.runIf(process.platform === "win32")(
  "prompt actor with a real native CLI protocol fixture and real Store",
  () => {
    const state = { binary: "", sourceHome: "" };
    beforeAll(async () => {
      state.sourceHome = await mkdtemp(join(tmpdir(), "ordine-prompt-test-"));
      state.binary = join(state.sourceHome, "codex-fixture.exe");
      const compiler = join(
        process.env.SystemRoot ?? "C:/Windows",
        "System32/WindowsPowerShell/v1.0/powershell.exe",
      );
      const source = fileURLToPath(new URL("fixtureCodex.cs", import.meta.url));
      const script = join(state.sourceHome, "compile.ps1");
      await writeFile(
        script,
        "param([string]$Source,[string]$Destination)\n$ErrorActionPreference='Stop'\nAdd-Type -Path $Source -OutputAssembly $Destination -OutputType ConsoleApplication",
        "utf8",
      );
      await promisify(execFile)(
        compiler,
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          script,
          "-Source",
          source,
          "-Destination",
          state.binary,
        ],
        { windowsHide: true, timeout: 20_000 },
      );
      await writeFile(
        join(state.sourceHome, "config.toml"),
        'model_provider="fixture"\n[model_providers.fixture]\nname="fixture"\nbase_url="https://example.invalid/v1"\nwire_api="responses"\nenv_key="PROVIDER_API_KEY"\n',
        "utf8",
      );
    }, 30_000);
    afterEach(async () => {
      vi.unstubAllEnvs();
      for (const path of directories.splice(0)) await cleanup(path);
    });
    afterAll(async () => {
      if (state.sourceHome) await cleanup(state.sourceHome);
    });
    const setup = async (scenario = "success") => {
      vi.stubEnv("CODEX_HOME", state.sourceHome);
      vi.stubEnv("PROVIDER_API_KEY", "fixture-credential");
      vi.stubEnv("DATABASE_URL", "must-not-be-inherited");
      const fixture = await promptFixture(state.binary);
      directories.push(fixture.directory);
      await writeFile(join(fixture.workspace, "scenario.txt"), scenario, "utf8");

      return fixture;
    };
    it("delivers complete typed input and selected-provider environment and cleans credentials", async () => {
      const f = await setup();
      const asset = await f.store.importInput(
        {
          subjectId: "owner",
          workspaceId: "workspace",
          scopes: ["artifacts:import", "artifacts:read"],
        },
        {
          importRequestId: randomUUID(),
          name: "中文.txt",
          mimeType: "text/plain",
          bytes: Buffer.from("真实artifact输入", "utf8"),
        },
      );
      if (asset.isErr()) throw asset.error;
      f.context.inputs = {
        input: [
          { kind: "text", value: "完整中文输入" },
          { kind: "artifact", artifactId: asset.value.artifactId },
        ],
      };
      delete f.context.operation.outputPorts[0]!.jsonSchema;
      const events: RuntimeEvent[] = [];
      const result = await createExecutionPromptActor({
        artifactStore: f.store,
        onRuntimeEvent: async (_context, event) => {
          events.push(event);

          return ok(undefined);
        },
      }).execute(f.context);
      expect(result.isOk(), result.isErr() ? result.error.message : "success").toBe(true);
      if (result.isOk())
        expect(result.value.out).toEqual([{ kind: "json", value: { proof: "fixture-ok" } }]);
      const request = JSON.parse(await readFile(join(f.workspace, "captured-prompt.json"), "utf8"));
      expect(request.inputs).toEqual(f.context.inputs);
      expect(request.artifactInputs[asset.value.artifactId]).toMatchObject({
        content: "真实artifact输入",
        encoding: "utf8",
        sha256: asset.value.sha256,
        sizeBytes: asset.value.sizeBytes,
      });
      expect(request.context).toMatchObject({
        sharedContext: "shared 中文",
        attemptId: f.context.attemptId,
        iteration: 1,
        attemptNumber: 1,
      });
      expect(await readFile(join(f.workspace, "captured-env.txt"), "utf8")).toContain(
        "database=False;credential=True;",
      );
      expect(events.map((event) => event.type)).toEqual([
        "status",
        "session",
        "status",
        "message",
        "usage",
        "terminal",
      ]);
      const credentials = await ResultAsync.fromPromise(
        stat(join(f.workspace, "codex-home/config.toml")),
        () => undefined,
      );
      expect(credentials.isErr()).toBe(true);
    }, 60_000);
    it.each([
      ["bad-json", "PROMPT_JSON_INVALID"],
      ["runtime-error", "CODEX_TURN_FAILED"],
      ["tool", "PROMPT_STREAM_UNSUPPORTED"],
      ["nonzero", "SCRIPT_EXIT_NONZERO"],
      ["missing-completion", "PROMPT_COMPLETION_MISSING"],
    ])(
      "fails closed for %s",
      async (scenario, code) => {
        const f = await setup(scenario);
        const events: RuntimeEvent[] = [];
        const result = await createExecutionPromptActor({
          artifactStore: f.store,
          onRuntimeEvent: async (_context, event) => {
            events.push(event);

            return ok(undefined);
          },
        }).execute(f.context);
        expect(result.isErr() ? result.error.code : "success").toBe(code);
        expect(
          events.some((event) => event.type === "terminal" && event.status === "completed"),
        ).toBe(false);
      },
      60_000,
    );
    it("bounds callback persistence and cancels the native process before returning", async () => {
      const f = await setup("callback-block");
      const result = await createExecutionPromptActor({
        artifactStore: f.store,
        limits: { callbackTimeoutMs: 50 },
        onRuntimeEvent: async () => new Promise(() => {}),
      }).execute(f.context);
      expect(result.isErr() ? result.error.code : "success").toBe("PROMPT_EVENT_TIMEOUT");
    }, 60_000);
    it("rejects unsupported effort and oversize prompt without invoking model execution", async () => {
      const f = await setup();
      f.context.resolved.reasoningEffort = "unsupported";
      const result = await createExecutionPromptActor({ artifactStore: f.store }).execute(
        f.context,
      );
      expect(result.isErr() ? result.error.code : "success").toBe("PROMPT_OPTIONS_UNSUPPORTED");
      const capturedPrompt = await ResultAsync.fromPromise(
        stat(join(f.workspace, "captured-prompt.json")),
        () => undefined,
      );
      expect(capturedPrompt.isErr()).toBe(true);
      const large = await setup();
      const exceeded = await createExecutionPromptActor({
        artifactStore: large.store,
        limits: { maxPromptBytes: 16 },
      }).execute(large.context);
      expect(exceeded.isErr() ? exceeded.error.code : "success").toBe("PROMPT_INPUT_LIMIT");
    }, 60_000);
  },
);
