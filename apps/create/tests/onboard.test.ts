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
  isExistingInstall,
  readExistingEnv,
  resolveAppServerEntry,
  resolveMigrationsDir,
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
  it("generates config with default port", () => {
    const config = generateEnvConfig("/tmp/test-ordine");
    expect(config.APP_PORT).toBe(9430);
    expect(config.APP_URL).toBe("http://localhost:9430");
    expect(config.DATA_DIR).toBe("/tmp/test-ordine");
  });

  it("includes DATABASE_URL when provided", () => {
    const config = generateEnvConfig("/tmp/test-ordine", "postgres://ordine:ordine@127.0.0.1:5480/ordine");
    expect(config.DATABASE_URL).toBe("postgres://ordine:ordine@127.0.0.1:5480/ordine");
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
    const config = generateEnvConfig(testDir, "postgres://ordine:ordine@127.0.0.1:5480/ordine");
    const result = writeEnvFile(testDir, config);
    expect(result.isOk()).toBe(true);

    const envPath = join(testDir, ".env");
    expect(existsSync(envPath)).toBe(true);

    const content = readFileSync(envPath, "utf-8");
    expect(content).toContain("APP_PORT=9430");
    expect(content).toContain("APP_URL=http://localhost:9430");
    expect(content).toContain("DATA_DIR=");
    expect(content).toContain("SECRET_KEY=");
    expect(content).toContain("DATABASE_URL=postgres://ordine:ordine@127.0.0.1:5480/ordine");
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
      databaseUrl: "postgres://ordine:ordine@127.0.0.1:5480/ordine",
    });

    expect(output).toContain("Ordine is running locally.");
    expect(output).toContain("App:      http://localhost:9430");
    expect(output).toContain("Database: postgres://ordine:ordine@127.0.0.1:5480/ordine");
    expect(output).toContain("Data:     ~/.ordine/default");
    expect(output).toContain("Press Ctrl+C to stop.");
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
    const config = generateEnvConfig(testDir, "postgres://ordine:ordine@127.0.0.1:5480/ordine");
    writeEnvFile(testDir, config);

    const result = readExistingEnv(testDir);
    expect(result.isOk()).toBe(true);
    const read = result._unsafeUnwrap();
    expect(read.APP_PORT).toBe(config.APP_PORT);
    expect(read.SECRET_KEY).toBe(config.SECRET_KEY);
    expect(read.DATABASE_URL).toBe(config.DATABASE_URL);
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

describe("resolveAppServerEntry", () => {
  it("resolves the app server entry path", () => {
    const entry = resolveAppServerEntry();
    expect(entry).toContain("server");
    expect(entry).toContain("index.mjs");
  });
});

describe("resolveMigrationsDir", () => {
  it("resolves the migrations directory", () => {
    const dir = resolveMigrationsDir();
    expect(dir).toContain("migrations");
  });
});
