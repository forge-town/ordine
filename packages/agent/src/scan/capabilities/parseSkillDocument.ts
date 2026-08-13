import { basename, dirname, extname } from "node:path";
import { z } from "zod/v4";
import { Result } from "neverthrow";
import { parse as parseYaml } from "yaml";

export const ParsedSkillDocumentSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  description: z.string(),
  path: z.string().min(1),
});
export type ParsedSkillDocument = z.infer<typeof ParsedSkillDocumentSchema>;

export class SkillDocumentParseError extends Error {
  constructor(cause: unknown) {
    super("Unable to parse skill frontmatter", { cause });
    this.name = "SkillDocumentParseError";
  }
}

const toSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const toLabel = (value: string): string =>
  value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

const defaultName = (path: string): string =>
  basename(path).toLowerCase() === "skill.md"
    ? basename(dirname(path))
    : basename(path, extname(path));

const firstBodyLine = (body: string): string =>
  body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?.replace(/^#{1,6}\s*/, "")
    .trim()
    .slice(0, 1024) ?? "";

const frontmatterParts = (content: string): { raw?: string; body: string } => {
  const normalized = content.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) return { body: normalized.trim() };
  const closeIndex = normalized.indexOf("\n---\n", 4);
  if (closeIndex < 0) return { raw: normalized.slice(4), body: "" };

  return {
    raw: normalized.slice(4, closeIndex),
    body: normalized.slice(closeIndex + 5).trim(),
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const parseSkillDocument = ({
  path,
  content,
}: {
  path: string;
  content: string;
}): Result<ParsedSkillDocument, SkillDocumentParseError> => {
  const parts = frontmatterParts(content);
  const parsedFrontmatter = Result.fromThrowable(
    () => asRecord(parts.raw === undefined ? {} : (parseYaml(parts.raw) as unknown)),
    (cause) => new SkillDocumentParseError(cause),
  )();

  return parsedFrontmatter.map((fields) => {
    const frontmatterName = typeof fields.name === "string" ? fields.name : undefined;
    const name = toSlug(frontmatterName ?? defaultName(path)) || "unnamed-skill";
    const frontmatterDescription =
      typeof fields.description === "string" ? fields.description.trim() : undefined;
    const description = frontmatterDescription || firstBodyLine(parts.body) || name;

    return ParsedSkillDocumentSchema.parse({
      name,
      label: toLabel(frontmatterName ?? name) || name,
      description,
      path,
    });
  });
};
