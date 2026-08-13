import { createHash } from "node:crypto";
import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { z } from "zod/v4";
import { CapabilitySourceIdSchema, CapabilitySourceScopeSchema } from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import {
  CapabilitySkillRootSchema,
  getCapabilitySkillRoots,
  type CapabilitySkillRoot,
  type CapabilitySkillRootConsumer,
} from "./capabilitySkillRoots";
import { CapabilityAdapterContextSchema, type CapabilityAdapterContext } from "./capabilitySchemas";
import { parseSkillDocument, ParsedSkillDocumentSchema } from "./parseSkillDocument";

const MAX_SCAN_DEPTH = 6;

export const ScannedSkillSourceSchema = z.object({
  sourceKey: z.string().min(1),
  source: CapabilitySourceIdSchema,
  scope: CapabilitySourceScopeSchema,
});

export const ScannedSkillSchema = ParsedSkillDocumentSchema.extend({
  sources: z.array(ScannedSkillSourceSchema).min(1),
});
export type ScannedSkill = z.infer<typeof ScannedSkillSchema>;

export const SkillRootScanSchema = z.object({
  path: z.string().min(1),
  scope: CapabilitySourceScopeSchema,
  status: z.enum(["parsed", "missing", "unreadable"]),
  skillCount: z.number().int().nonnegative(),
});
export type SkillRootScan = z.infer<typeof SkillRootScanSchema>;

export const SkillScanDiagnosticSchema = z.object({
  path: z.string().min(1),
  code: z.enum(["unreadable-directory", "unreadable-file", "malformed-skill"]),
});
export type SkillScanDiagnostic = z.infer<typeof SkillScanDiagnosticSchema>;

export const SkillCapabilityScanResultSchema = z.object({
  skills: z.array(ScannedSkillSchema),
  roots: z.array(SkillRootScanSchema),
  diagnostics: z.array(SkillScanDiagnosticSchema),
});
export type SkillCapabilityScanResult = z.infer<typeof SkillCapabilityScanResultSchema>;

type DirectoryEntry = Dirent<string>;
type ReadDirectory = (path: string) => Promise<DirectoryEntry[]>;
type ReadTextFile = (path: string) => Promise<string>;

const readDirectoryFromDisk: ReadDirectory = (path) =>
  readdir(path, { withFileTypes: true, encoding: "utf8" });
const readTextFileFromDisk: ReadTextFile = (path) => readFile(path, "utf8");

export interface ScanSkillCapabilitiesOptions extends CapabilityAdapterContext {
  roots?: CapabilitySkillRoot[];
  readDirectory?: ReadDirectory;
  readTextFile?: ReadTextFile;
}

interface SkillFileCandidate {
  path: string;
  consumers: Array<CapabilitySkillRootConsumer & { scope: "global" | "workspace" }>;
}

const isMissingPath = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "ENOENT";

const skillSourceKey = (
  source: z.infer<typeof CapabilitySourceIdSchema>,
  scope: z.infer<typeof CapabilitySourceScopeSchema>,
  path: string,
): string =>
  createHash("sha256")
    .update([source, scope, normalize(path)].join("\0"))
    .digest("hex");

const collectSkillFiles = async ({
  root,
  path,
  depth,
  readDirectory,
}: {
  root: CapabilitySkillRoot;
  path: string;
  depth: number;
  readDirectory: ReadDirectory;
}): Promise<{ files: SkillFileCandidate[]; diagnostics: SkillScanDiagnostic[] }> => {
  if (depth > MAX_SCAN_DEPTH) return { files: [], diagnostics: [] };
  const entriesResult = await ResultAsync.fromPromise(readDirectory(path), (error) => error);
  if (entriesResult.isErr()) {
    return {
      files: [],
      diagnostics: [{ path, code: "unreadable-directory" }],
    };
  }

  const files: SkillFileCandidate[] = [];
  const diagnostics: SkillScanDiagnostic[] = [];
  for (const rawEntry of entriesResult.value) {
    const entry = rawEntry as DirectoryEntry;
    const entryPath = join(path, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === "skill.md") {
      files.push({
        path: entryPath,
        consumers: root.consumers.map((consumer) => ({ ...consumer, scope: root.scope })),
      });
    } else if (entry.isFile() && depth === 0 && extname(entry.name).toLowerCase() === ".md") {
      const flatConsumers = root.consumers.filter((consumer) => consumer.supportsFlatFiles);
      if (flatConsumers.length > 0) {
        files.push({
          path: entryPath,
          consumers: flatConsumers.map((consumer) => ({ ...consumer, scope: root.scope })),
        });
      }
    } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const child = await collectSkillFiles({
        root,
        path: entryPath,
        depth: depth + 1,
        readDirectory,
      });
      files.push(...child.files);
      diagnostics.push(...child.diagnostics);
    }
  }

  return { files, diagnostics };
};

const rootStatus = (
  root: CapabilitySkillRoot,
  status: "parsed" | "missing" | "unreadable",
  skillCount: number,
): SkillRootScan =>
  SkillRootScanSchema.parse({ path: root.path, scope: root.scope, status, skillCount });

export const scanSkillCapabilities = async (
  input: ScanSkillCapabilitiesOptions,
): Promise<SkillCapabilityScanResult> => {
  const context = CapabilityAdapterContextSchema.parse(input);
  const roots = (input.roots ?? getCapabilitySkillRoots(context)).map((root) =>
    CapabilitySkillRootSchema.parse(root),
  );
  const readDirectory = input.readDirectory ?? readDirectoryFromDisk;
  const readTextFile = input.readTextFile ?? readTextFileFromDisk;

  const scannedRoots = await Promise.all(
    roots.map(async (root) => {
      const firstRead = await ResultAsync.fromPromise(readDirectory(root.path), (error) => error);
      if (firstRead.isErr()) {
        return {
          root: rootStatus(root, isMissingPath(firstRead.error) ? "missing" : "unreadable", 0),
          files: [],
          diagnostics: [],
        };
      }

      const collected = await collectSkillFiles({
        root,
        path: root.path,
        depth: 0,
        readDirectory: (path) =>
          path === root.path ? Promise.resolve(firstRead.value) : readDirectory(path),
      });

      return {
        root: rootStatus(root, "parsed", collected.files.length),
        files: collected.files,
        diagnostics: collected.diagnostics,
      };
    }),
  );

  const uniqueFiles = new Map<string, SkillFileCandidate>();
  for (const candidate of scannedRoots.flatMap((result) => result.files)) {
    const key = process.platform === "win32" ? candidate.path.toLowerCase() : candidate.path;
    const existing = uniqueFiles.get(key);
    if (!existing) {
      uniqueFiles.set(key, candidate);
      continue;
    }
    for (const consumer of candidate.consumers) {
      if (
        !existing.consumers.some(
          (entry) => entry.source === consumer.source && entry.scope === consumer.scope,
        )
      ) {
        existing.consumers.push(consumer);
      }
    }
  }

  const parsedFiles = await Promise.all(
    [...uniqueFiles.values()].map(async (candidate) => {
      const content = await ResultAsync.fromPromise(readTextFile(candidate.path), (error) => error);
      if (content.isErr()) {
        return {
          diagnostic: SkillScanDiagnosticSchema.parse({
            path: candidate.path,
            code: "unreadable-file",
          }),
        };
      }
      const parsed = parseSkillDocument({ path: candidate.path, content: content.value });
      if (parsed.isErr()) {
        return {
          diagnostic: SkillScanDiagnosticSchema.parse({
            path: candidate.path,
            code: "malformed-skill",
          }),
        };
      }

      return {
        skill: ScannedSkillSchema.parse({
          ...parsed.value,
          sources: candidate.consumers.map((consumer) => ({
            sourceKey: skillSourceKey(consumer.source, consumer.scope, candidate.path),
            source: consumer.source,
            scope: consumer.scope,
          })),
        }),
      };
    }),
  );

  return SkillCapabilityScanResultSchema.parse({
    skills: parsedFiles.flatMap((result) => (result.skill ? [result.skill] : [])),
    roots: scannedRoots.map((result) => result.root),
    diagnostics: [
      ...scannedRoots.flatMap((result) => result.diagnostics),
      ...parsedFiles.flatMap((result) => (result.diagnostic ? [result.diagnostic] : [])),
    ],
  });
};
