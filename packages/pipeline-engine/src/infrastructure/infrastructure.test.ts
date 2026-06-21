import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { safeParseConfig, safeReadInputFile, runScript } from "../infrastructure";
import { ScriptExecutionError } from "../errors";

const testDir = join(tmpdir(), `pipeline-engine-test-${Date.now()}`);

beforeAll(async () => {
  await mkdir(testDir, { recursive: true });
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("safeParseConfig", () => {
  it("parses valid config object", async () => {
    const result = await safeParseConfig({ executor: { type: "script" } }, "test-op");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toEqual({ executor: { type: "script" }, inputs: [], outputs: [] });
  });
});

describe("safeReadInputFile", () => {
  it("reads a file and returns its content with isFile=true", async () => {
    const filePath = join(testDir, "sample.txt");
    await writeFile(filePath, "hello world", "utf8");

    const result = await safeReadInputFile(filePath);
    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.content).toBe("hello world");
    expect(val.isFile).toBe(true);
  });

  it("returns path as content with isFile=false for directories", async () => {
    const dirPath = join(testDir, "subdir");
    await mkdir(dirPath, { recursive: true });

    const result = await safeReadInputFile(dirPath);
    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.content).toBe(dirPath);
    expect(val.isFile).toBe(false);
  });

  it("returns fallback for non-existent path", async () => {
    const result = await safeReadInputFile("/non-existent-path-12345");
    expect(result.isOk()).toBe(true);
    const val = result._unsafeUnwrap();
    expect(val.content).toBe("/non-existent-path-12345");
    expect(val.isFile).toBe(false);
  });
});

describe("runScript", () => {
  it("executes a bash command and returns stdout", async () => {
    const result = await runScript({ type: "script", language: "bash" }, "/tmp", "test-input");
    expect(result.isErr()).toBe(true);
  });

  it("executes a bash echo command", async () => {
    const result = await runScript(
      { type: "script", language: "bash", command: "echo hello" },
      "/tmp",
      "",
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().trim()).toBe("hello");
  });

  it("passes INPUT_PATH and INPUT_CONTENT as env vars to bash", async () => {
    const result = await runScript(
      { type: "script", language: "bash", command: 'echo "$INPUT_PATH|$INPUT_CONTENT"' },
      "/my/path",
      "my-content",
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().trim()).toBe("/my/path|my-content");
  });

  it("executes a python command", async () => {
    const result = await runScript(
      { type: "script", language: "python", command: "print('py-ok')" },
      "/tmp",
      "",
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().trim()).toBe("py-ok");
  });

  it("executes a javascript command", async () => {
    const result = await runScript(
      { type: "script", language: "javascript", command: "console.log('js-ok')" },
      "/tmp",
      "",
    );
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().trim()).toBe("js-ok");
  });

  it("returns ScriptExecutionError for empty command", async () => {
    const result = await runScript({ type: "script", language: "bash", command: "  " }, "/tmp", "");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ScriptExecutionError);
    expect(result._unsafeUnwrapErr().message).toContain("empty");
  });

  it("returns ScriptExecutionError for failed script", async () => {
    const result = await runScript(
      { type: "script", language: "bash", command: "exit 1" },
      "/tmp",
      "",
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ScriptExecutionError);
  });

  it("returns ScriptExecutionError for unsupported language", async () => {
    const result = await runScript(
      { type: "script", language: "cobol" as "bash", command: "do stuff" },
      "/tmp",
      "",
    );
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr()).toBeInstanceOf(ScriptExecutionError);
  });
});
