import { getNextCronRunAt } from "@repo/utils/cron";

const MAX_OCCURRENCES_PER_DAY = 1440;

export const cronOccurrencesForDay = (cron: string, day: Date): Date[] => {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const occurrences: Date[] = [];
  let cursor = new Date(start.getTime() - 60_000);
  while (occurrences.length < MAX_OCCURRENCES_PER_DAY) {
    const next = getNextCronRunAt(cron, cursor);
    if (!next || next >= end) break;
    if (next >= start) occurrences.push(next);
    cursor = next;
  }

  return occurrences;
};
