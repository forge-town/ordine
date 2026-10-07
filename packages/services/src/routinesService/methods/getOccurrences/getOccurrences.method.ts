import type { createRoutinesDao } from "@repo/models";

import { getCronOccurrenceBuckets } from "@repo/utils";

const MAX_CALENDAR_OCCURRENCES = 512;
const MAX_ROUTINE_OCCURRENCE_BUCKETS = 200;
export const createGetOccurrencesMethod =
  (dao: ReturnType<typeof createRoutinesDao>) => async (from: Date, to: Date) => {
    const routines = await dao.findManyEnabled();
    const allOccurrences = routines
      .flatMap((routine) =>
        getCronOccurrenceBuckets(
          routine.cronExpression,
          from,
          to,
          MAX_ROUTINE_OCCURRENCE_BUCKETS,
        ).map((bucket) => ({
          aggregated: bucket.aggregated,
          at: bucket.at.toISOString(),
          routineId: routine.id,
        })),
      )
      .sort((left, right) => left.at.localeCompare(right.at));

    return {
      occurrences: allOccurrences.slice(0, MAX_CALENDAR_OCCURRENCES),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
      truncated: allOccurrences.length > MAX_CALENDAR_OCCURRENCES,
    };
  };
