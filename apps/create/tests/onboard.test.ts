import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  resolveDataDir,
  generateEnvConfig,
  prepareDataDir,
  writeEnvFile,
  formatOutput,
  startLocalService,
  startDaemon,
  isExistingInstall,
  readExistingEnv,
} from "../src/onboard";

describe("resolveDataDir", () => {
  it("returns custom path when provided", () => {
    const result = resolveDataDir("/custom/path");
    expect(result).toBe("/custom/path");
  });

  it("defaults to ~/.ordine/default when no custom path", () => {
    const result = resolveDataDir();
    expect(result).toContain(".ordine");
    expect(result).toContain("default");
  });
});

describe("generateEnvConfig", () => {
  it("generates config with default ports", () => {
    const config = generateEnvConfig("/tmp/test-ordine");
    expect(config.APP_PORT).toBe(9430);
    expect(config.API_PORT).toBe(9433);
    expect(config.APP_URL).toBe("http://localhost:9430");
    expect(config.API_URL).toBe("http://localhost:9433");
    expect(config.DATA_DIR).toBe("/tmp/test-ordine");
  });

  it("generates a 64-character hex secret key", () => {
    const config = generateEnvConfig("/tmp/test-ordine");
    expect(config.SECRET_KEY).toHaveLength(64);
    expect(config.SECRET_KEY).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique secret keys on each call", () => {
    const config1 = generateEnvConfig("/tmp/test-ordine");
    const config2 = generateEnvConfig("/tmp/test-ordine");
    expect(config1.SECRET_KEY).not.toBe(config2.SECRET_KEY);
  });
});

describe("prepareDataDir", () => {
  const testDir = join(tmpdir(), `ordine-test-${Date.now()}`);

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("creates the directory when it does not exist", () => {
    const result = prepareDataDir(testDir);
    expect(result.isOk()).toBe(true);
    expect(existsSync(testDir)).toBe(true);
  });

  it("succeeds when directory already exists (idempotent)", () => {
    mkdirSync(testDir, { recursive: true });
    const result = prepareDataDir(testDir);
    expect(result.isOk()).toBe(true);
  });

  it("returns the data dir path on success", () => {
    const result = prepareDataDir(testDir);
    expect(result._unsafeUnwrap()).toBe(testDir);
  });
});

describe("writeEnvFile", () => {
  const testDir = join(tmpdir(), `ordine-env-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true });
  });

  it("writes .env file with all config keys", () => {
    const config = generateEnvConfig(testDir);
    const result = writeEnvFile(testDir, config);
    expect(result.isOk()).toBe(true);

    const envPath = join(testDir, ".env");
    expect(existsSync(envPath)).toBe(true);

    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("APP_PORT=9430");
    expect(content).toContain("API_PORT=9433");
    expect(content).toContain("APP_URL=http://localhost:9430");
    expect(content).toContain("API_URL=http://localhost:9433");
    expect(content).toContain("DATA_DIR=");
    expect(content).toContain("SECRET_KEY=");
  });

  it("returns the env file path on success", () => {
    const config = generateEnvConfig(testDir);
    const result = writeEnvFile(testDir, config);
    expect(result._unsafeUnwrap()).toBe(join(testDir, ".env"));
  });
});

describe("formatOutput", () => {
  it("formats the onboarding result as expected", () => {
    const output = formatOutput({
      dataDir: "~/.ordine/default",
      appUrl: "http://localhost:9430",
      apiUrl: "http://localhost:9433",
    });

    expect(output).toContain("Ordine is running locally.");
    expect(output).toContain("App:      http://localhost:9430");
    expect(output).toContain("API:      http://localhost:9433");
    expect(output).toContain("Data:     ~/.ordine/default");
    expect(output).toContain("Status:   ordine status");
    expect(output).toContain("Stop:     ordine stop");
    expect(output).toContain("Logs:     ordine logs");
  });
});

describe("isExistingInstall", () => {
  const testDir = join(tmpdir(), `ordine-idempotent-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("returns false when no .env exists", () => {
    expect(isExistingInstall(testDir)).toBe(false);
  });

  it("returns true when .env exists", () => {
    const config = generateEnvConfig(testDir);
    writeEnvFile(testDir, config);
    expect(isExistingInstall(testDir)).toBe(true);
  });
});

describe("readExistingEnv", () => {
  const testDir = join(tmpdir(), `ordine-readenv-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("reads back the same config that was written", () => {
    const config = generateEnvConfig(testDir);
    writeEnvFile(testDir, config);

    const result = readExistingEnv(testDir);
    expect(result.isOk()).toBe(true);
    const read = result._unsafeUnwrap();
    expect(read.APP_PORT).toBe(config.APP_PORT);
    expect(read.API_PORT).toBe(config.API_PORT);
    expect(read.SECRET_KEY).toBe(config.SECRET_KEY);
  });

  it("preserves the original secret on re-read (idempotent)", () => {
    const config = generateEnvConfig(testDir);
    writeEnvFile(testDir, config);

    const read1 = readExistingEnv(testDir)._unsafeUnwrap();
    const read2 = readExistingEnv(testDir)._unsafeUnwrap();
    expect(read1.SECRET_KEY).toBe(read2.SECRET_KEY);
    expect(read1.SECRET_KEY).toBe(config.SECRET_KEY);
  });
});

describe("startLocalService", () => {
  const testDir = join(tmpdir(), `ordine-svc-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("spawns a process and returns its pid", () => {
    const config = generateEnvConfig(testDir);
    const result = startLocalService(testDir, config);
    expect(result.isOk()).toBe(true);
    const pid = result._unsafeUnwrap();
    expect(pid).toBeGreaterThan(0);

    // Clean up spawned process
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // may already be gone
    }
  });
});

describe("startDaemon", () => {
  const testDir = join(tmpdir(), `ordine-daemon-test-${Date.now()}`);

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true });
    }
  });

  it("spawns a daemon process and returns its pid", () => {
    const config = generateEnvConfig(testDir);
    const result = startDaemon(testDir, config);
    expect(result.isOk()).toBe(true);
    const pid = result._unsafeUnwrap();
    expect(pid).toBeGreaterThan(0);

    // Clean up spawned process
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // may already be gone
    }
  });

  it("writes to daemon.log file", () => {
    const config = generateEnvConfig(testDir);
    startDaemon(testDir, config);

    const logFile = join(testDir, "daemon.log");
    expect(existsSync(logFile)).toBe(true);
  });
});
