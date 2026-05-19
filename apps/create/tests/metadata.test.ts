import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testsDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testsDir, "..");
const repoRoot = join(packageRoot, "..", "..");
const packageJson = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")) as {
  bin: Record<string, string>;
  description: string;
  name: string;
  version: string;
};
const changesetConfig = readFileSync(join(repoRoot, ".changeset", "config.json"), "utf8");
const changesetPre = readFileSync(join(repoRoot, ".changeset", "pre.json"), "utf8");
const changelog = readFileSync(join(packageRoot, "CHANGELOG.md"), "utf8");
const cliSource = readFileSync(join(packageRoot, "src", "index.ts"), "utf8");

describe("create package metadata", () => {
  it("keeps the published package identity aligned with npm", () => {
    expect(packageJson.name).toBe("@ordine/create");
    expect(packageJson.description).toContain("npm create @ordine");
    expect(packageJson.bin["create-ordine"]).toBe("dist/index.js");
    expect(changesetConfig).toContain('"@ordine/create"');
    expect(changesetPre).toContain('"@ordine/create"');
    expect(changelog).toContain("# @ordine/create");
  });

  it("keeps the CLI version string aligned with package.json", () => {
    expect(cliSource).toContain(`.version("${packageJson.version}")`);
  });
});
