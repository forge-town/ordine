import type { createSkillsDao } from "@repo/models";
import { mapWithMeta } from "@repo/schemas";

import type { SkillImportCandidate } from "../../contracts";

const IMPORTED_CATEGORY = "imported";

const IMPORTED_TAG = "imported";

export const createImportCandidatesMethod =
  (dao: ReturnType<typeof createSkillsDao>) => async (candidates: SkillImportCandidate[]) => {
    const imported = [];
    for (const candidate of candidates) {
      const existing = await dao.findByName(candidate.name);
      if (existing) {
        const updated = await dao.update(existing.id, {
          label: candidate.label,
          description: candidate.description,
          category: IMPORTED_CATEGORY,
          origin: "manual",
          tags: existing.tags.includes(IMPORTED_TAG)
            ? existing.tags
            : [...existing.tags, IMPORTED_TAG],
        });
        if (updated) imported.push(updated);
      } else {
        imported.push(
          await dao.create({
            id: candidate.id,
            name: candidate.name,
            label: candidate.label,
            description: candidate.description,
            category: IMPORTED_CATEGORY,
            tags: [IMPORTED_TAG],
          }),
        );
      }
    }

    return mapWithMeta(imported);
  };
