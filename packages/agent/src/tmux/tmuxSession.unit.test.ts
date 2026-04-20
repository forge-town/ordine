import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChildProcess } from "node:child_process";

const execFileMock =
  vi.fn<
    (
      file: string,
      args: string[],
      callback: (error: Error | null, stdout: string, stderr: string) => void,
    ) => ChildProcess
  >();

vi.mock("node:child_process", () => ({
  execFile: (
    file: string,
    args: string[],
    callback: (error: Error | null, stdout: string, stderr: string) => void,
  ) => execFileMock(file, args, callback),
}));

vi.mock("@repo/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  createTmuxSession,
  capturePane,
  killTmuxSession,
  isTmuxSessionAlive,
  sendKeys,
  buildSessionName,
} from "./tmuxSession";

describe("buildSessionName", () => {
  it("produces a name prefixed with ordine-codex-", () => {
    const name = buildSessionName();
    expect(name).toMatch(/^ordine-codex-[a-z0-9]+$/);
  });

  it("produces unique names on successive calls", () => {
    const a = buildSessionName();
    const b = buildSessionName();
    expect(a).not.toBe(b);
  });
});

describe("createTmuxSession", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls tmux new-session with correct args", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(null, "", "");

      return {} as ChildProcess;
    });

    await createTmuxSession({
      sessionName: "ordine-codex-abc123",
      command: "codex exec --sandbox read-only",
      cwd: "/tmp/project",
    });

    expect(execFileMock).toHaveBeenCalledOnce();
    const [bin, args] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("tmux");
    expect(args).toContain("new-session");
    expect(args).toContain("-d");
    expect(args).toContain("-s");
    expect(args).toContain("ordine-codex-abc123");
    expect(args).toContain("-c");
    expect(args).toContain("/tmp/project");
    expect(args.at(-1)).toBe("codex exec --sandbox read-only");
  });

  it("rejects when tmux command fails", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(new Error("tmux not found"), "", "tmux not found");

      return {} as ChildProcess;
    });

    await expect(
      createTmuxSession({
        sessionName: "test-session",
        command: "echo hello",
        cwd: "/tmp",
      }),
    ).rejects.toThrow("tmux not found");
  });
});

describe("capturePane", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("returns captured pane content", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(null, "line 1\nline 2\nline 3\n", "");

      return {} as ChildProcess;
    });

    const content = await capturePane("ordine-codex-abc123");
    expect(content).toBe("line 1\nline 2\nline 3\n");

    const [bin, args] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("tmux");
    expect(args).toContain("capture-pane");
    expect(args).toContain("-p");
    expect(args).toContain("-t");
    expect(args).toContain("ordine-codex-abc123");
  });

  it("rejects when session does not exist", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(new Error("session not found"), "", "session not found");

      return {} as ChildProcess;
    });

    await expect(capturePane("nonexistent")).rejects.toThrow("session not found");
  });
});

describe("killTmuxSession", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("calls tmux kill-session", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(null, "", "");

      return {} as ChildProcess;
    });

    await killTmuxSession("ordine-codex-abc123");

    const [bin, args] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("tmux");
    expect(args).toContain("kill-session");
    expect(args).toContain("-t");
    expect(args).toContain("ordine-codex-abc123");
  });

  it("does not throw when session already dead", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(new Error("session not found"), "", "");

      return {} as ChildProcess;
    });

    // Should not throw — killing a dead session is a no-op
    await killTmuxSession("already-dead");
  });
});

describe("isTmuxSessionAlive", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("returns true when session exists", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(null, "", "");

      return {} as ChildProcess;
    });

    const alive = await isTmuxSessionAlive("ordine-codex-abc123");
    expect(alive).toBe(true);

    const [bin, args] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("tmux");
    expect(args).toContain("has-session");
    expect(args).toContain("-t");
  });

  it("returns false when session does not exist", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(new Error("session not found"), "", "");

      return {} as ChildProcess;
    });

    const alive = await isTmuxSessionAlive("nonexistent");
    expect(alive).toBe(false);
  });
});

describe("sendKeys", () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it("calls tmux send-keys with the text and Enter", async () => {
    execFileMock.mockImplementation((_file, _args, cb) => {
      cb(null, "", "");

      return {} as ChildProcess;
    });

    await sendKeys("ordine-codex-abc123", "hello world");

    const [bin, args] = execFileMock.mock.calls[0]!;
    expect(bin).toBe("tmux");
    expect(args).toContain("send-keys");
    expect(args).toContain("-t");
    expect(args).toContain("ordine-codex-abc123");
    expect(args).toContain("hello world");
    expect(args).toContain("Enter");
  });
});
