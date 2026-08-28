import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

type RegistryComponent = {
  name: string;
  upstreamUrl: string;
  upstreamSha256: string | null;
  localPath: string;
  primitive: string;
  localSha256?: string;
  registryDependencies?: string[];
};

type TransitiveDependency = {
  name: string;
  upstreamSha256: string;
  targetPath?: string;
};

type RegistryManifest = {
  source: { repository: string; commit: string; license: string; licenseFile: string };
  components: RegistryComponent[];
  transitiveDependencies?: TransitiveDependency[];
};

const packageRoot = resolve(import.meta.dir, "..");
const manifestPath = resolve(packageRoot, "animate-ui.registry.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RegistryManifest;
const offline = process.argv.includes("--offline");
const bannedImports = ["@base-ui-components/react", "@radix-ui/", "radix-ui", "@headlessui/"];

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

let failed = false;
console.log(`Animate UI source: ${manifest.source.repository}@${manifest.source.commit}`);
console.log(`License: ${manifest.source.license} (${manifest.source.licenseFile})`);

for (const component of manifest.components) {
  const localPath = resolve(packageRoot, component.localPath);
  const source = await readFile(localPath);
  const localSha256 = sha256(source);
  const importStack = bannedImports.filter((value) => source.toString("utf8").includes(value));

  console.log(`- ${component.name}: ${component.localPath}`);
  console.log(`  primitive=${component.primitive} localSha256=${localSha256}`);

  if (!component.localSha256) {
    console.error(
      `  ERROR missing pinned localSha256; update the manifest after intentional edits`,
    );
    failed = true;
  } else if (component.localSha256 !== localSha256) {
    console.error(`  ERROR local hash drift: expected ${component.localSha256}`);
    failed = true;
  }

  const sourceText = source.toString("utf8");
  const fullMotionRuntimeImports = sourceText.split("\n").filter((line) => {
    if (line.includes("import type")) return false;

    return /(?:from|import\()\s*["'](?:motion\/react|framer-motion)["']/.test(line);
  });

  if (!sourceText.includes(component.primitive)) {
    console.error(`  ERROR expected primitive import ${component.primitive} was not found`);
    failed = true;
  }
  if (sourceText.includes("transition-all")) {
    console.error("  ERROR transition-all is forbidden in adapted overlays");
    failed = true;
  }
  if (importStack.length > 0) {
    console.error(`  ERROR mixed primitive stack detected: ${importStack.join(", ")}`);
    failed = true;
  }
  if (fullMotionRuntimeImports.length > 0) {
    console.error("  ERROR full Motion runtime entry detected; use LazyMotion/domMax and m");
    failed = true;
  }

  if (!offline && component.upstreamSha256) {
    try {
      const response = await fetch(component.upstreamUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const upstreamSha256 = sha256(new Uint8Array(await response.arrayBuffer()));
      console.log(`  upstreamSha256=${upstreamSha256}`);
      if (upstreamSha256 !== component.upstreamSha256) {
        console.error(`  ERROR upstream hash drift: expected ${component.upstreamSha256}`);
        failed = true;
      }
    } catch (error) {
      console.error(`  ERROR upstream registry check failed: ${String(error)}`);
      failed = true;
    }
  }
}

const transitiveDependencies = manifest.transitiveDependencies ?? [];
const componentByName = new Map(
  manifest.components.map((component) => [component.name, component]),
);
const transitiveByName = new Map(
  transitiveDependencies.map((dependency) => [dependency.name, dependency]),
);

function normalizeDependencyName(name: string) {
  return name.replace(/^@animate-ui\//, "");
}

function printDependencyTree(name: string, indent: string, ancestors: Set<string>) {
  const normalizedName = normalizeDependencyName(name);
  const component = componentByName.get(normalizedName);
  const transitive = transitiveByName.get(normalizedName);

  if (!component && !transitive) {
    console.error(`  ERROR missing Registry dependency ${name}`);
    failed = true;
    return;
  }

  if (ancestors.has(normalizedName)) {
    console.log(`${indent}- ${normalizedName} (cycle)`);
    return;
  }

  if (component) {
    console.log(
      `${indent}- ${component.name} target=${component.localPath} localSha256=${component.localSha256 ?? "<missing>"}`,
    );
    const nextAncestors = new Set(ancestors).add(normalizedName);
    for (const dependency of component.registryDependencies ?? []) {
      printDependencyTree(dependency, `${indent}  `, nextAncestors);
    }
    return;
  }

  console.log(
    `${indent}- ${transitive.name} target=${transitive.targetPath ?? "<not vendored>"} upstreamSha256=${transitive.upstreamSha256}`,
  );
}

console.log("Registry dependency graph:");
for (const component of manifest.components) {
  printDependencyTree(component.name, "  ", new Set());
}

if (failed) {
  console.error(
    "Animate UI inspection failed; review the manifest before changing adapted source.",
  );
  process.exitCode = 1;
} else {
  console.log(
    offline ? "Animate UI inspection passed (offline)." : "Animate UI inspection passed.",
  );
}
