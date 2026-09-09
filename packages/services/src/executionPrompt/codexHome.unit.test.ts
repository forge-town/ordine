import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { inspectCodexCredentialRef, prepareCodexHome } from "./codexHome";

const directories: string[] = [];
const fixture = async () => {
  const source = await mkdtemp(join(tmpdir(), "ordine-profile-test-"));
  directories.push(source);
  vi.stubEnv("CODEX_HOME", source);
  vi.stubEnv("PROFILE_TEST_KEY", "test-credential-original");
  const config =
    'model_provider="fixture"\n[model_providers.fixture]\nname="fixture"\nbase_url="https://example.invalid/v1"\nenv_key="PROFILE_TEST_KEY"\n';
  await writeFile(join(source, "config.toml"), config, "utf8");

  return { source, config, destination: join(source, "attempt") };
};

afterEach(async () => {
  vi.unstubAllEnvs();
  for (const directory of directories.splice(0)) {
    const target = resolve(directory);
    if (
      dirname(target) !== resolve(tmpdir()) ||
      !basename(target).startsWith("ordine-profile-test-")
    )
      throw new Error("Unsafe profile fixture cleanup");
    await rm(target, { recursive: true, force: true });
  }
});

it("copies the exact currently approved profile without exposing credential material in its reference", async () => {
  const f = await fixture();
  const reference = await inspectCodexCredentialRef();
  expect(reference).toMatch(/^codex-[a-f0-9]{64}$/u);
  const prepared = await prepareCodexHome(f.destination, reference);
  expect(prepared.environment.PROFILE_TEST_KEY).toBe("test-credential-original");
  expect(prepared.environment.CODEX_HOME).toBe(f.destination);
  expect(prepared.redact("test-credential-original")).toBe("[redacted]");
  expect(await readFile(join(f.destination, "config.toml"), "utf8")).toContain("example.invalid");
  expect(await inspectCodexCredentialRef()).toBe(reference);
});

it.each(["provider", "credential"])(
  "rejects changed %s before copying secrets or starting a process",
  async (change) => {
    const f = await fixture();
    const reference = await inspectCodexCredentialRef();
    if (change === "provider")
      await writeFile(
        join(f.source, "config.toml"),
        f.config.replace("example.invalid", "changed.invalid"),
        "utf8",
      );
    else vi.stubEnv("PROFILE_TEST_KEY", "test-credential-replaced");
    await expect(prepareCodexHome(f.destination, reference)).rejects.toMatchObject({
      code: "PROMPT_CREDENTIAL_CHANGED",
    });
    await expect(stat(f.destination)).rejects.toMatchObject({ code: "ENOENT" });
  },
);

it("rejects a revoked credential despite a prior approved reference", async () => {
  const f = await fixture();
  const reference = await inspectCodexCredentialRef();
  vi.stubEnv("PROFILE_TEST_KEY", "");
  await expect(prepareCodexHome(f.destination, reference)).rejects.toMatchObject({
    code: "PROMPT_AUTH_UNAVAILABLE",
  });
});

it("ignores unrelated UI settings while keeping the selected provider fixed", async () => {
  const f = await fixture();
  const reference = await inspectCodexCredentialRef();
  await writeFile(join(f.source, "config.toml"), `theme="dark"\n${f.config}`, "utf8");
  expect(await inspectCodexCredentialRef()).toBe(reference);
});
