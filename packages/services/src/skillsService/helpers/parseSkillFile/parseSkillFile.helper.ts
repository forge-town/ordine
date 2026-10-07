import { randomUUID } from "node:crypto";

import { basename } from "node:path";

import type { SkillImportCandidate } from "../../contracts";
import { toSlug } from "../toSlug";
import { toLabel } from "../toLabel";
import { parseFrontmatter } from "../parseFrontmatter";
import { extractDescription } from "../extractDescription";

export const parseSkillFile = ({
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
