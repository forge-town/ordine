import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createSkillsDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta } from "@repo/schemas";
import { ResultAsync } from "neverthrow";

export interface SkillImportCandidate {
  id: string;
  name: string;
  label: string;
  description: string;
  path: string;
}

export interface SkillImportPreview {
  candidates: SkillImportCandidate[];
  errors: string[];
}

const SKILL_FILE_NAME = "SKILL.md";
const MAX_SCAN_DEPTH = 6;
const IMPORTED_CATEGORY = "imported";
const IMPORTED_TAG = "imported";

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const toLabel = (value: string) =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const parseFrontmatter = (content: string) => {
  if (!content.startsWith("---")) {
    return { fields: new Map<string, string>(), body: content.trim() };
  }

  const closeIndex = content.indexOf("\n---", 3);
  if (closeIndex < 0) {
    return { fields: new Map<string, string>(), body: content.trim() };
  }

  const frontmatterRaw = content.slice(3, closeIndex);
  const body = content.slice(closeIndex + 4).trim();
  const fields = new Map<string, string>();

  const lines = frontmatterRaw.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line) {
      i++;
      continue;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      i++;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      i++;
      continue;
    }

    if (rawValue === "|" || rawValue === ">") {
      const blockLines: string[] = [];
      const nextLine = lines[i + 1];
      const indentMatch = nextLine ? nextLine.match(/^(\s+)/) : null;
      const blockIndent = indentMatch && indentMatch[1] ? indentMatch[1].length : 2;
      i++;
      while (i < lines.length) {
        const blockLine = lines[i];
        if (!blockLine) {
          i++;
          continue;
        }
        if (blockLine.trim().length === 0) {
          blockLines.push("");
          i++;
          continue;
        }
        const spaceMatch = blockLine.match(/^(\s*)/);
        const leadingSpaces = spaceMatch && spaceMatch[1] ? spaceMatch[1].length : 0;
        if (leadingSpaces < blockIndent) break;
        blockLines.push(blockLine.slice(blockIndent));
        i++;
      }
      const value = blockLines.join("\n").trim();
      if (value) fields.set(key, value);
      continue;
    }

    const value = rawValue.replaceAll(/^["']|["']$/g, "");
    if (value) fields.set(key, value);
    i++;
  }

  return { fields, body };
};

const extractDescription = (body: string, frontmatterDescription?: string): string => {
  if (frontmatterDescription && frontmatterDescription.trim().length > 0) {
    return frontmatterDescription.trim();
  }

  const firstParagraph = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)[0];

  if (!firstParagraph) return "";

  return firstParagraph.replace(/^#{1,6}\s*/, "").trim();
};

const parseSkillFile = ({
  path,
  content,
}: {
  path: string;
  content: string;
}): SkillImportCandidate => {
  const { fields, body } = parseFrontmatter(content);
  const directoryName = basename(path.replace(/[/\\]SKILL\.md$/i, ""));
  const name = toSlug(fields.get("name") ?? directoryName) || `imported-skill-${randomUUID()}`;
  const description = extractDescription(body, fields.get("description"));

  return {
    id: `imported-${name}`,
    name,
    label: toLabel(name) || name,
    description: description || name,
    path,
  };
};

const scanSkillFiles = async ({
  rootPath,
  currentDepth = 0,
}: {
  rootPath: string;
  currentDepth?: number;
}): Promise<{ paths: string[]; errors: string[] }> => {
  if (currentDepth > MAX_SCAN_DEPTH) {
    return { paths: [], errors: [] };
  }

  const entriesResult = await ResultAsync.fromPromise(
    readdir(rootPath, { withFileTypes: true }),
    (error) => error,
  );

  if (entriesResult.isErr()) {
    return { paths: [], errors: [`Failed to read ${rootPath}: ${String(entriesResult.error)}`] };
  }

  const paths: string[] = [];
  const errors: string[] = [];
  for (const entry of entriesResult.value) {
    const entryPath = join(rootPath, entry.name);
    if (entry.isFile() && entry.name === SKILL_FILE_NAME) {
      paths.push(entryPath);
    }
    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      const child = await scanSkillFiles({ rootPath: entryPath, currentDepth: currentDepth + 1 });
      paths.push(...child.paths);
      errors.push(...child.errors);
    }
  }

  return { paths, errors };
};

export const createSkillsService = (db: DbConnection) => {
  const dao = createSkillsDao(db);

  const previewImport = async ({ rootPath }: { rootPath: string }): Promise<SkillImportPreview> => {
    const scanResult = await scanSkillFiles({ rootPath });
    const candidates: SkillImportCandidate[] = [];
    const errors = [...scanResult.errors];

    for (const path of scanResult.paths) {
      const contentResult = await ResultAsync.fromPromise(readFile(path, "utf8"), (error) => error);
      if (contentResult.isErr()) {
        errors.push(`Failed to read ${path}: ${String(contentResult.error)}`);
      } else {
        candidates.push(parseSkillFile({ path, content: contentResult.value }));
      }
    }

    return { candidates, errors };
  };

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    getByName: async (name: string) => withMeta(await dao.findByName(name)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
    seedIfEmpty: () => dao.seedIfEmpty(),
    previewImport,
    importCandidates: async (candidates: SkillImportCandidate[]) => {
      const imported = [];
      for (const candidate of candidates) {
        const existing = await dao.findByName(candidate.name);
        if (existing) {
          const updated = await dao.update(existing.id, {
            label: candidate.label,
            description: candidate.description,
            category: IMPORTED_CATEGORY,
            tags: existing.tags.includes(IMPORTED_TAG)
              ? existing.tags
              : [...existing.tags, IMPORTED_TAG],
          });
          if (updated) imported.push(updated);
        } else {
          imported.push(await dao.create({
            id: candidate.id,
            name: candidate.name,
            label: candidate.label,
            description: candidate.description,
            category: IMPORTED_CATEGORY,
            tags: [IMPORTED_TAG],
          }));
        }
      }

      return mapWithMeta(imported);
    },
  };
};
